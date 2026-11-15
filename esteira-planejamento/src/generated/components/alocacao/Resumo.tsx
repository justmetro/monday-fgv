import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useState } from 'react';
import { cn } from '@lib/utils';
import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { type ModeloAlocacao, TEMP_CARDS, TEMP_COR, contaNoTotal, PAUSADA, CAPS, CAP_COR, CAP_CURTO, capRegraTexto, type RegraCapacidade } from '@generated/lib/alocacao';
import { DOT, cor } from '@generated/components/alocacao/cores';
import { InfoDica } from '@generated/components/ui-bits';

/** Collapsible summary: temperature donut (destinations) + manager capacity bars. */
export function Resumo({ modelo, regra }: { modelo: ModeloAlocacao; regra: RegraCapacidade }) {
  const regraTxt = capRegraTexto(regra);
  // Temperatures of the projects without a manager in the 02.01 ("Projeção novos projetos").
  const contaveis = modelo.semGerente.filter(contaNoTotal);
  const totalGerentes = modelo.gerentes.length + (modelo.novoGerente.projetos > 0 ? 1 : 0);
  const total = contaveis.length;
  const temps = TEMP_CARDS.map((t) => ({ label: t, value: contaveis.filter((d) => d.temp.valor === t).length, corVar: TEMP_COR[t] }));
  const caps = CAPS.map((c) => ({ label: CAP_CURTO[c], value: modelo.gerentes.filter((g) => g.cap.valor === c).length, corVar: CAP_COR[c] }));
  const maxCap = Math.max(1, ...caps.map((c) => c.value));
  const comDados = temps.filter((t) => t.value > 0);
  // Visual only: highlights one temperature in the donut.
  const [foco, setFoco] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative mx-auto size-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={comDados.length ? comDados : [{ label: 'Nenhum', value: 1, corVar: '--temp-sem' }]} dataKey="value" nameKey="label"
                innerRadius={52} outerRadius={74} paddingAngle={comDados.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                {(comDados.length ? comDados : [{ label: 'Nenhum', value: 1, corVar: '--temp-sem' }]).map((d) => <Cell key={d.label} fill={cor(d.corVar)} fillOpacity={foco && foco !== d.label ? 0.25 : 1} className="transition-[fill-opacity] duration-200" />)}
              </Pie>
              {comDados.length > 0 && (
                <Tooltip content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as { label: string; value: number } | undefined;
                  return active && d ? (
                    <div className="rounded-[var(--radius-md)] border border-border bg-popover px-2.5 py-1.5 text-xs">{d.label}: <span className="tnum font-medium">{d.value}</span></div>
                  ) : null;
                }} />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <NumberTicker value={foco ? (temps.find((t) => t.label === foco)?.value ?? 0) : total} className="fx-num tnum text-3xl font-light leading-none text-foreground" />
            <span className="mt-1 max-w-[100px] truncate text-center text-[10px] uppercase tracking-wide text-muted-foreground">{foco ?? 'na projeção'}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">Distribuição por temperatura <InfoDica texto="Projetos sem gerente no 02.01 (ou com projeção pendente) por temperatura de assinatura; “Negociação pausada” fica fora do total." /></p>
          <ul className="flex w-fit max-w-full flex-col gap-0.5">
            {temps.map((t) => (
              <li key={t.label} className={cn('min-w-0', t.value === 0 && 'opacity-60')}>
                <button type="button" aria-pressed={foco === t.label} onClick={() => setFoco((f) => (f === t.label ? null : t.label))}
                  className={cn('flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left text-xs transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7',
                    foco === t.label && 'bg-[hsl(var(--accent-soft))]')}>
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[t.corVar])} aria-hidden />
                  <span className={cn('tnum inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold', t.value === 0 ? 'bg-[hsl(var(--surface-3))] text-[hsl(var(--fg-subtle))]' : 'bg-[hsl(var(--surface-3))] text-foreground')}>{t.value}</span>
                  <span className={cn('min-w-0 truncate', t.value === 0 ? 'text-[hsl(var(--fg-subtle))]' : 'text-muted-foreground')}>{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {modelo.semGerente.length > total && (
            <p className="mt-1.5 text-[11px] text-[hsl(var(--fg-subtle))]">{modelo.semGerente.length - total} em “{PAUSADA}” fora do total</p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-foreground">Capacidade dos gerentes <InfoDica texto={regraTxt} /></p>
          <span className="tnum text-xs text-muted-foreground" title="“Novo gerente” conta como 1">Total {totalGerentes}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {caps.map((c) => (
            <li key={c.label} className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-2 text-xs">
              <span className="text-muted-foreground">{c.label}</span>
              <progress value={c.value} max={maxCap} aria-label={`${c.label}: ${c.value} gerentes`}
                className={cn('h-2.5 w-full appearance-none overflow-hidden rounded-full bg-[hsl(var(--surface-3))] [&::-webkit-progress-bar]:bg-[hsl(var(--surface-3))] [&::-webkit-progress-value]:rounded-full',
                  BAR[c.corVar])} />
              <span className="tnum text-right font-medium text-foreground">{c.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-[hsl(var(--fg-subtle))]">{regraTxt}</p>
      </div>
    </div>
  );
}

const BAR: Record<string, string> = {
  '--cap-curto': '[&::-webkit-progress-value]:bg-[hsl(var(--cap-curto))] [&::-moz-progress-bar]:bg-[hsl(var(--cap-curto))]',
  '--cap-medio': '[&::-webkit-progress-value]:bg-[hsl(var(--cap-medio))] [&::-moz-progress-bar]:bg-[hsl(var(--cap-medio))]',
  '--cap-longo': '[&::-webkit-progress-value]:bg-[hsl(var(--cap-longo))] [&::-moz-progress-bar]:bg-[hsl(var(--cap-longo))]',
  '--farol-gray': '[&::-webkit-progress-value]:bg-[hsl(var(--farol-gray))] [&::-moz-progress-bar]:bg-[hsl(var(--farol-gray))]',
};
