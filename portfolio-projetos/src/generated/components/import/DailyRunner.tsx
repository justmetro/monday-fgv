import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { claimDailyRun, finishDailyRun, reportDailyProject } from '@generated/server/daily';
import { stagedRefresh } from './stagedRefresh';

const CHECK_MS = 10 * 60 * 1000;

/**
 * Rotina diária: em dia útil, a partir de 00:00 (Brasília), a primeira sessão aberta do aplicativo
 * atualiza todos os projetos, um por vez, como em "Atualizar todos os projetos".
 * Outras sessões não repetem; uma execução interrompida é retomada de onde parou.
 */
export function DailyRunner() {
  const running = useRef(false);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const c = await claimDailyRun({ data: {} });
        if (!c?.run) return;
        const id = toast.loading('Atualização diária dos projetos', { description: `0 de ${c.projects.length}` });
        let fails = 0;
        for (let i = 0; i < c.projects.length && alive; i++) {
          const p = c.projects[i]!;
          toast.loading('Atualização diária dos projetos', { id, description: `${i + 1} de ${c.projects.length} · ${p.name}` });
          let r: { ok: boolean; summary: string };
          try {
            const x = await stagedRefresh(p);
            r = { ok: x.ok && (!x.history || x.history.ok), summary: `${x.summary}${x.history ? ` · Cadastro: ${x.history.summary}` : ''}` };
          } catch (e) {
            console.error('[rotina diária]', p.name, e);
            r = { ok: false, summary: e instanceof Error ? e.message.slice(0, 500) : 'Falha na atualização.' };
          }
          if (!r.ok) fails++;
          await reportDailyProject({ data: { id: c.id, boardId: p.boardId, name: p.name, ok: r.ok, summary: r.summary.slice(0, 3900) || '—' } }).catch((e) => console.error(e));
        }
        if (!alive) return;
        await finishDailyRun({ data: { id: c.id } });
        if (fails) toast.warning('Atualização diária concluída com falhas', { id, description: `${fails} de ${c.projects.length} projeto(s) falharam. Veja o log em Importação e atualização.` });
        else toast.success('Atualização diária concluída', { id, description: `${c.projects.length} projeto(s) atualizados.` });
      } catch (e) { console.error('[rotina diária]', e); }
      finally { running.current = false; }
    };
    void tick();
    const t = setInterval(() => void tick(), CHECK_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return null;
}
