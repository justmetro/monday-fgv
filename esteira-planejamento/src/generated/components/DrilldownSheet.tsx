import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { Spinner } from '@components/ui/spinner';
import { cn } from '@lib/utils';
import { type Projeto, codigoDe, tituloDe, DASH } from '@generated/lib/format';
import { isInativo } from '@generated/lib/board-options';
import { nomesGerentesDe } from '@generated/lib/carga';
import type { Changes } from '@generated/server/projetos';
import { StatusPill, EmptyState } from '@generated/components/ui-bits';
import { inputCls } from '@generated/components/edit-fields';
import { ConfirmSave } from '@generated/components/ConfirmSave';

import { useAbrirProjeto } from '@generated/components/AbrirProjeto';
import { QuadroPlanLink } from '@generated/components/ProjectView';

interface Props {
  titulo: string | null;
  subtitulo: string;
  projetos: Projeto[];
  opcoesStatus: string[];
  salvar: (p: Projeto, c: Changes) => Promise<boolean>;
  onClose: () => void;
}

/** Side panel listing the projects behind a clicked chart category. */
export function DrilldownSheet({ titulo, subtitulo, projetos, opcoesStatus, salvar, onClose }: Props) {
  const abrir = useAbrirProjeto();
  const [pendente, setPendente] = useState<{ p: Projeto; v: string } | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const confirmar = async () => {
    if (!pendente) return;
    const { p, v } = pendente;
    setPendente(null);
    setSalvandoId(p.id);
    await salvar(p, { statusPlanejamento: v || null });
    setSalvandoId(null);
  };

  return (
    <Sheet open={titulo !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-border bg-card p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="pr-8 text-lg font-medium">{titulo}</SheetTitle>
          <SheetDescription className="text-xs">
            {subtitulo} · {projetos.length} projeto{projetos.length === 1 ? '' : 's'} · respeita os filtros ativos
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {projetos.length === 0 ? (
            <EmptyState title="Nenhum projeto nesta categoria" hint="Os filtros atuais não deixam projetos aqui." />
          ) : (
            <ul className="divide-y divide-border">
              {projetos.map((p) => {
                const gerentes = nomesGerentesDe(p).map((g) => g.nome);
                const atual = p.statusPlanejamento ?? '';
                const opts = atual && !opcoesStatus.includes(atual) ? [atual, ...opcoesStatus] : opcoesStatus;
                return (
                  <li key={p.id} data-item-id={p.id} className={cn('flex flex-col gap-2 px-5 py-3', isInativo(p.statusPlanejamento) && 'bg-[hsl(var(--surface-2)/0.45)]')}>
                    <button type="button" onClick={() => abrir?.(p)} title="Ver detalhes"
                      className="group flex min-w-0 items-baseline gap-2 text-left rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="font-mono-code shrink-0 text-[11px] text-primary">{codigoDe(p) ?? DASH}</span>
                      <span className="min-w-0 truncate text-[13px] font-medium text-foreground group-hover:underline group-hover:underline-offset-2">{tituloDe(p)}</span>
                      <span className="sr-only">(abre o painel de detalhes)</span>
                    </button>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 flex-1 truncate" title={gerentes.join(', ')}>{gerentes.length ? gerentes.join(', ') : 'Sem gerente'}</span>
                      <StatusPill label={p.statusPlanejamento} className="max-w-[45%]" />
                      <label htmlFor={`dd-${p.id}`} className="sr-only">Alterar Status Planejamento de {p.name}</label>
                      <select id={`dd-${p.id}`} value={atual} disabled={salvandoId === p.id}
                        onChange={(e) => e.target.value !== atual && setPendente({ p, v: e.target.value })}
                        className={cn(inputCls, 'h-11 w-auto max-w-[200px] md:h-8')}>
                        {!atual && <option value="">Sem status</option>}
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {salvandoId === p.id && <Spinner className="size-3.5" />}
                      <QuadroPlanLink p={p} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
      <ConfirmSave open={!!pendente} campos={pendente ? [`Status Planejamento: ${pendente.v}`] : []}
        onCancel={() => setPendente(null)} onConfirm={() => void confirmar()} />
    </Sheet>
  );
}
