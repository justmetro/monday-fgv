import { NomeLink } from '@generated/components/NomeLink';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@lib/utils';
import { Spinner } from '@components/ui/spinner';
import { type Projeto, codigoDe, fmtDate, DASH } from '@generated/lib/format';
import { isInativo } from '@generated/lib/board-options';
import { etapasDe } from '@generated/lib/farol';
import { nomesGerentesDe } from '@generated/lib/carga';
import type { Changes } from '@generated/server/projetos';
import { FarolChip, StatusPill } from '@generated/components/ui-bits';
import { NaoAssinado } from '@generated/components/Etiquetas';
import { inputCls } from '@generated/components/edit-fields';
import { QuadroPlanLink } from '@generated/components/ProjectView';
import { normalizarUrlMonday } from '@generated/lib/links';

interface Props {
  p: Projeto;
  opcoes: string[];
  onOpen: (p: Projeto) => void;
  salvar: (p: Projeto, c: Changes) => Promise<boolean>;
}

/** One project line of the Status SGI tab, with quick Status SGI edit (no confirmation). */
export function StatusSgiRow({ p, opcoes, onOpen, salvar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const inativo = isInativo(p.statusPlanejamento);
  const sgi = etapasDe(p).find((e) => e.key === 'sgi');
  const gerentes = nomesGerentesDe(p).map((g) => g.nome);
  const atual = p.statusSgi ?? '';
  const opts = atual && !opcoes.includes(atual) ? [atual, ...opcoes] : opcoes;
  const painel = normalizarUrlMonday(p.painelSgi?.url);
  const selId = `sgi-${p.id}`;

  const mudar = async (v: string) => {
    if (v === atual) return;
    setSalvando(true);
    await salvar(p, { statusSgi: v || null });
    setSalvando(false);
  };

  return (
    <li data-item-id={p.id} className={cn('flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:gap-3', inativo && 'bg-[hsl(var(--surface-2)/0.45)]')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <button type="button" onClick={() => onOpen(p)} aria-label={`Abrir detalhes de ${p.name}`} title="Abrir detalhes"
            className="font-mono-code shrink-0 rounded-[var(--radius-sm)] text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {codigoDe(p) ?? DASH}
          </button>
          <NomeLink p={p} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate" title={gerentes.join(', ')}>{gerentes.length ? gerentes.join(', ') : 'Sem gerente'}</span>
          <StatusPill label={p.statusPlanejamento} />
          {sgi && <FarolChip farol={sgi.farol} text={`Registro SGI · ${sgi.detalhe}`} />}
          {!p.dataDeAssinatura && <NaoAssinado />}
          <span className="tnum">Validação SGI {fmtDate(p.dataValidaoSgi)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {painel && (
          <a href={painel} target="_blank" rel="noopener noreferrer" aria-label={`Abrir Painel SGI de ${p.name}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-[13px] text-foreground transition-colors duration-150 hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--surface-3))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 md:h-8">
            <ExternalLink className="size-3.5 text-primary" aria-hidden /> Painel SGI
          </a>
        )}
        <label htmlFor={selId} className="sr-only">Status SGI de {p.name}</label>
        <select id={selId} value={atual} disabled={salvando} onChange={(e) => void mudar(e.target.value)}
          className={cn(inputCls, 'w-full appearance-auto pr-1 disabled:opacity-60 sm:w-56')}>
          <option value="">— vazio —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {salvando && <Spinner className="size-3.5" />}
        <QuadroPlanLink p={p} />
      </div>
    </li>
  );
}
