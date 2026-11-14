import { Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { GROUP_LABEL, groupIdOf, parseConfig, type GroupKey } from '@generated/lib/fields';
import type { ProjectDoc } from '@generated/models';
import { fmtDateTime } from '@generated/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { cn } from '@lib/utils';

type GS = Partial<Record<string, { status: 'ok' | 'error' | 'off'; message: string; at: string }>>;
const parse = (raw: string | undefined): GS => { try { return raw ? (JSON.parse(raw) as GS) : {}; } catch { return {}; } };

/** Contadores e resultado da última atualização por grupo; grupos novos não configurados mostram atalho. */
export function GroupChips({ p, busy, onConfigure, onRefresh }: { p: ProjectDoc; busy: boolean; onConfigure: () => void; onRefresh: (g: GroupKey) => void }) {
  if (p.noIndicators) return null;
  const cfg = parseConfig(p.config);
  const gs = parse(p.groupSync);
  const count: Record<GroupKey, number | undefined> = { ind: p.indicatorCount, med: p.measurementCount, sched: p.scheduleCount, prod: p.productCount, risk: p.riskCount };
  const keys: GroupKey[] = ['ind', 'med', 'sched', 'prod', 'risk'];
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {keys.map((g) => {
        const on = !!groupIdOf(cfg, g);
        const s = gs[g];
        if (!on) {
          return (
            <li key={g}>
              <button onClick={onConfigure} className="flex min-h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground hover:bg-muted">
                <Settings2 className="size-3.5" aria-hidden />{GROUP_LABEL[g]} · não configurado
              </button>
            </li>
          );
        }
        const tone = s?.status === 'error' ? 'border-destructive/40 text-destructive' : s?.status === 'ok' || g === 'ind' || g === 'med' ? 'border-border' : 'border-[hsl(var(--warn))]/40 text-[hsl(var(--warn))]';
        const label = g === 'sched' && cfg?.importSubitems ? `${count[g] ?? 0} + ${p.subitemCount ?? 0} sub.` : String(count[g] ?? 0);
        return (
          <li key={g}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => onRefresh(g)} disabled={busy} aria-label={`Atualizar somente ${GROUP_LABEL[g]}`} className={cn('flex min-h-9 items-center gap-1.5 rounded-md border bg-card px-2 text-xs hover:bg-muted disabled:opacity-50', tone)}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
                  {GROUP_LABEL[g]} · <span className="font-mono">{label}</span>
                  {s?.status === 'error' && <span>· falhou</span>}
                  {!s && (g === 'sched' || g === 'prod' || g === 'risk') && <span>· aguardando atualização</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                {s ? <>{s.status === 'error' ? 'Última tentativa falhou — exibindo a versão anterior. ' : 'Última atualização: '}{fmtDateTime(s.at)}<br />{s.message}</> : 'Clique para atualizar somente este grupo.'}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
