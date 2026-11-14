import { ExternalLink } from 'lucide-react';
import { BOARD_PROJ, itemUrl, fmtDate } from '@generated/lib';

/** 02.01 projects of the period — consultation only, no classification */
export default function ProjectList({ rows }) {
  if (!rows.length) return <p className="text-sm text-[hsl(var(--goal))]">Nenhum projeto do 02.01 com este mês de referência.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((p) => (
        <li key={p.id} className="space-y-1 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <a href={itemUrl(BOARD_PROJ, p.id)} target="_blank" rel="noreferrer" className="min-w-0 font-semibold leading-snug hover:underline">
              {p.name} <ExternalLink className="inline h-3 w-3 opacity-60" />
            </a>
            {p.statusPlan && <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{p.statusPlan}</span>}
          </div>
          <p className="text-xs text-[hsl(var(--goal))]">
            {p.gerente} · Assinatura {fmtDate(p.assin)} · Conclusão do planejamento {fmtDate(p.concPlan)} · Registro SGI {fmtDate(p.concSgi)}
          </p>
        </li>
      ))}
    </ul>
  );
}
