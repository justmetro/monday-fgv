import { useCallback, useEffect, useRef, useState } from 'react';
import { gql, errorMessage, sleep } from '@generated/lib/monday';
import { updateProject } from '@generated/lib/engineRun';
import { readProjectLinks } from '@generated/lib/sendData';
import { sendProject, postProjectUpdate, updateBody } from '@generated/lib/sendRun';

const IDLE = { running: false, phase: '', total: 0, done: 0, fraction: 0, currentName: '', results: [], fatal: null };

/** Orquestra o envio ao planejamento, projeto a projeto, com o login de quem clicou. */
export function useSender({ onProjectDone, onFinished }) {
  const [run, setRun] = useState(IDLE);
  const busy = useRef(false);

  useEffect(() => {
    if (!run.running) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [run.running]);

  const start = useCallback(async (ids) => {
    if (busy.current || !ids?.length) return;
    busy.current = true;
    setRun({ ...IDLE, running: true, total: ids.length, phase: 'Identificando usuário…' });
    try {
      const me = await gql('query { me { id name account { slug } } }');
      const slug = me?.me?.account?.slug || '';
      const userName = me?.me?.name || 'usuário';
      setRun((r) => ({ ...r, phase: 'Lendo links de planejamento (09.1)…' }));
      const projects = await readProjectLinks(ids);
      const missing = ids.length - projects.length;
      setRun((r) => ({ ...r, total: projects.length, phase: missing ? `${missing} projeto(s) não encontrados foram ignorados.` : '' }));

      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        setRun((r) => ({ ...r, currentName: p.name, done: i, fraction: 0 }));
        let result;
        try {
          const out = await sendProject(p, { slug }, (phase, fraction) => setRun((r) => ({ ...r, phase, fraction })));
          const main = `Cópia de riscos para o planejamento (${out.destName}): ${out.copied} copiados`
            + `${out.skipped ? `, ${out.skipped} já existiam` : ''}.`
            + `${out.warnings.length ? ` Avisos: ${out.warnings.join('; ')}` : ''}`;
          await postProjectUpdate(p.id, updateBody(userName, main));
          await updateProject(p.id, { envio_plan: { label: 'Enviado' } });
          result = { id: p.id, name: p.name, status: out.warnings.length ? 'Enviado c/ avisos' : 'Enviado', ...out, url: out.destUrl };
        } catch (err) {
          console.error(`Erro ao enviar o projeto ${p.id}:`, err);
          const msg = errorMessage(err);
          try {
            await postProjectUpdate(p.id, updateBody(userName, `Erro ao copiar riscos para o planejamento: ${msg}`));
            await updateProject(p.id, { envio_plan: { label: 'Erro' } });
          } catch (e2) {
            console.error('Não foi possível registrar o erro no projeto:', e2);
          }
          result = { id: p.id, name: p.name, status: 'Erro', error: msg, copied: 0, skipped: 0, warnings: [], destName: null };
        }
        setRun((r) => ({ ...r, results: [...r.results, result], done: i + 1, fraction: 0 }));
        onProjectDone?.(result);
        if (i < projects.length - 1) await sleep(400);
      }
      setRun((r) => ({ ...r, running: false, currentName: '', phase: '' }));
    } catch (err) {
      console.error('Falha ao preparar o envio:', err);
      setRun((r) => ({ ...r, running: false, fatal: `Não foi possível iniciar o envio: ${errorMessage(err)}` }));
    } finally {
      busy.current = false;
      onFinished?.();
    }
  }, [onProjectDone, onFinished]);

  const clear = useCallback(() => { if (!busy.current) setRun(IDLE); }, []);

  return { run, start, clear };
}
