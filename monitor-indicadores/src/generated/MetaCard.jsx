import { cn } from '@lib/utils';
import { fmtPct, fmtNum, isHit, unidade, saldoText, fmtBRL } from '@generated/lib';
import { Parcial } from '@generated/bits';

/** sentence with the numbers of the same period as the result (Atingido / Total Período of the measurements) */
const FRASES = {
  'IT1.1': (d, n) => `${d} projetos pactuados, dos quais ${n} tiveram o planejamento completo e validado no prazo.`,
  'IT1.2': (d, n) => `${d} projetos pactuados, dos quais ${n} foram planejados no SGI em até 21 dias.`,
  'IT2.1': (d, n) => `${d} profissionais a alocar, dos quais ${n} foram alocados no prazo previsto.`,
  'IT2.2': (d, n) => `${d} profissionais a realocar, dos quais ${n} foram realocados em até 15 dias.`,
  'IT3.1': (d, n) => `${d} produtos recorrentes, dos quais ${n} têm metodologia construída.`,
  'IT3.2': (d, n) => `${d} produtos, dos quais ${n} utilizaram metodologias padronizadas.`,
};
const ALVO = { 'IT1.3': ' para a equipe', 'IT1.4': ' para insumos' };
export function frase(i, r) {
  if (r.saldo) return `Saldo de ${fmtBRL(r.n ?? 0)} sobre ${fmtBRL(r.d)} orçados${ALVO[i.code] ?? ''} no período.`;
  const f = FRASES[i.code];
  return f ? f(fmtNum(r.d), fmtNum(r.n ?? 0)) : `${fmtNum(r.d)} ${unidade(i)} no período, dos quais ${fmtNum(r.n ?? 0)} atingiram o critério do indicador.`;
}
const base10 = (pct) => Math.round((pct ?? 0) / 10);

/** META x RESULTADO card — every number of the card comes from the same period (`r`) */
export default function MetaCard({ i, r, eyebrow, onClick, className }) {
  const meta = r?.meta ?? i.metaInd;
  const parcial = r?.state === 'parcial';
  const tem = r && r.state !== 'na' && r.state !== 'nocase' && r.apurado != null;
  const h = tem && !parcial ? isHit(r.apurado, meta, i.lower) : null;
  const un = unidade(i);
  const saldo = !!i.saldo;
  const Body = onClick ? 'button' : 'div';
  return (
    <Body type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6 text-left', onClick && 'hover:border-[hsl(var(--goal)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--goal))]">{eyebrow}{parcial && <Parcial />}</p>}
      <h2 className={cn('line-clamp-2 text-lg font-semibold leading-snug', eyebrow && 'mt-1')}>Indicador: {i.curto}</h2>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meta</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums text-primary">{fmtPct(meta)}</p>
          {meta != null && <p className="mt-1 text-sm text-muted-foreground">{saldo ? `saldo ≥ ${fmtPct(meta)} do orçado` : `${base10(meta)} a cada 10 ${un}`}</p>}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado</p>
          <p className={cn('mt-1 text-5xl font-bold tracking-tight tabular-nums', h == null ? 'text-[hsl(var(--na-ink))]' : h ? 'text-[hsl(var(--ok-ink))]' : 'text-[hsl(var(--below-ink))]')}>
            {tem ? fmtPct(r.apurado) : '—'}
          </p>
          {tem && <p className="mt-1 text-sm text-muted-foreground">{saldo ? saldoText(r) : `${base10(((r.n ?? 0) / r.d) * 100)} a cada 10 ${un}`}</p>}
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-3 text-sm leading-snug">
        {tem ? frase(i, r) : r?.state === 'nocase' ? 'Sem casos no período (Total Período vazio ou 0).' : 'Sem medição no período.'}
      </div>
    </Body>
  );
}
