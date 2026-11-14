import { useCallback, useEffect, useRef, useState } from 'react';
import { loadContext, readProjects } from '@generated/lib/engineData';
import { processProject, updateProject } from '@generated/lib/engineRun';
import { errorMessage, sleep, todayISO } from '@generated/lib/monday';

const IDLE = { running: false, phase: '', total: 0, done: 0, fraction: 0, currentName: '', results: [], fatal: null, finishedAt: null };

/** Orquestra a execução do motor: carrega as bases uma vez e processa os projetos em sequência. */
export function useRunner({ onProjectDone, onFinished }) {
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
    setRun({ ...IDLE, running: true, total: ids.length, phase: 'Preparando…' });
    try {
      const ctx = await loadContext((phase) => setRun((r) => ({ ...r, phase })));
      setRun((r) => ({ ...r, phase: 'Lendo respostas dos projetos (09.1)…' }));
      const projects = await readProjects(ids);
      const missing = ids.length - projects.length;
      setRun((r) => ({ ...r, total: projects.length, phase: missing ? `${missing} projeto(s) não encontrados foram ignorados.` : '' }));

      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        setRun((r) => ({ ...r, currentName: p.name, done: i, fraction: 0 }));
        let result;
        try {
          result = await processProject(ctx, p, (f) => setRun((r) => ({ ...r, fraction: f })));
        } catch (err) {
          console.error(`Erro no projeto ${p.id}:`, err);
          const msg = errorMessage(err);
          const log = `Erro: ${msg}`;
          try {
            await updateProject(p.id, { calc: { label: 'Erro' }, log_calc: { text: log } });
          } catch (e2) {
            console.error('Não foi possível registrar o erro no projeto:', e2);
          }
          result = { id: p.id, name: p.name, status: 'Erro', error: msg, log, groups: [], warnings: [], novos: 0, total: null, date: todayISO() };
        }
        setRun((r) => ({ ...r, results: [...r.results, result], done: i + 1, fraction: 0 }));
        onProjectDone?.(result);
        if (i < projects.length - 1) await sleep(300);
      }
      setRun((r) => ({ ...r, running: false, currentName: '', finishedAt: new Date() }));
    } catch (err) {
      console.error('Falha ao preparar a execução:', err);
      setRun((r) => ({ ...r, running: false, fatal: `Não foi possível carregar as bases da calculadora: ${errorMessage(err)}` }));
    } finally {
      busy.current = false;
      onFinished?.();
    }
  }, [onProjectDone, onFinished]);

  const clear = useCallback(() => { if (!busy.current) setRun(IDLE); }, []);

  return { run, start, clear };
}
