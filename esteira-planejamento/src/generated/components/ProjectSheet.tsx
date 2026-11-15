import { useState } from 'react';
import { Pencil, X, Save, AlertTriangle, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { Spinner } from '@components/ui/spinner';
import { type Projeto, codigoDe, DASH } from '@generated/lib/format';
import type { Changes } from '@generated/server/projetos';
import { draftFrom, diffDraft, precisaConfirmar, camposAlterados, type Draft } from '@generated/lib/edicao';
import type { EdicaoOpcoesProps } from '@generated/components/ProjectEditForm';
import { OPT } from '@generated/lib/board-options';
import { StatusPill } from '@generated/components/ui-bits';
import { ProjectView, LinkBtn } from '@generated/components/ProjectView';
import { urlItem } from '@generated/lib/links';
import { ProjectEditForm } from '@generated/components/ProjectEditForm';
import { ConfirmSave } from '@generated/components/ConfirmSave';

interface Props {
  projeto: Projeto | null;
  onClose: () => void;
  edicao: EdicaoOpcoesProps;
  salvar: (p: Projeto, c: Changes) => Promise<boolean>;
  salvando: boolean;
}

function Corpo({ p, edicao, salvar, salvando }: { p: Projeto } & Omit<Props, 'projeto' | 'onClose'>) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(p));
  const [pendente, setPendente] = useState<Changes | null>(null);

  // Item as it was when editing started: the user's changes are measured against it, so a refresh of
  // the base (60 s / focus / reload) never overwrites the draft nor sends fields the user didn't touch.
  const [origem, setOrigem] = useState<Projeto>(p);
  const ddOpts = edicao.res?.opts.gerente1 ?? OPT.gerente1;
  const entrar = () => { setOrigem(p); setDraft(draftFrom(p)); setEditando(true); };
  const { changes, invalid } = diffDraft(origem, draft, ddOpts);
  const qtd = camposAlterados(changes).length;
  const atualizadoFora = editando && origem !== p && JSON.stringify(draftFrom(origem)) !== JSON.stringify(draftFrom(p));
  /** Reload: take the board's current values, keeping only the fields the user changed. */
  const recarregar = () => {
    const antes = draftFrom(origem);
    const novo = draftFrom(p);
    const mesmo = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const sec of ['status', 'dates', 'nums', 'dds'] as const) {
      const alvo = novo[sec] as Record<string, unknown>;
      const meu = draft[sec] as Record<string, unknown>;
      const orig = antes[sec] as Record<string, unknown>;
      for (const k of Object.keys(alvo)) if (!mesmo(meu[k], orig[k])) alvo[k] = meu[k];
    }
    if (!mesmo(draft.rel, antes.rel)) novo.rel = draft.rel;
    novo.syncDd = draft.syncDd;
    setOrigem(p);
    setDraft(novo);
  };
  /** At save time: only the user's changes that still differ from the CURRENT item. */
  const finais = (): Changes => {
    const atual = diffDraft(p, draft, ddOpts).changes as Record<string, unknown>;
    return Object.fromEntries(Object.keys(changes).filter((k) => k in atual).map((k) => [k, atual[k]])) as Changes;
  };

  const gravar = async (c: Changes) => {
    setPendente(null);
    const ok = await salvar(p, c);
    if (ok) setEditando(false);
  };
  const onSalvar = () => {
    if (invalid.length) { toast.error('Valores inválidos', { description: invalid.join(', ') }); return; }
    if (!qtd) { setEditando(false); return; }
    const c = finais();
    if (!camposAlterados(c).length) {
      toast.info('Nada a salvar', { description: 'Os valores alterados já estão iguais no quadro.' });
      setEditando(false);
      return;
    }
    if (precisaConfirmar(c)) setPendente(c);
    else void gravar(c);
  };

  return (
    <>
      <SheetHeader className="gap-2 px-5 pb-4 pt-5 pr-12">
        <span className="font-mono-code text-xs text-primary">{codigoDe(p) ?? DASH}</span>
        <SheetTitle className="text-lg font-semibold leading-snug text-foreground">{p.name}</SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">{p.group?.title ?? DASH}</SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <StatusPill label={p.statusPlanejamento} />
          <StatusPill label={p.statusSgi} />
          {p.status && <StatusPill label={p.status} />}
          {p.prioridade && <StatusPill label={`Prioridade ${p.prioridade}`} />}
        </div>
      </SheetHeader>

      <div className="flex flex-wrap gap-2 px-5 pb-4">
        {!editando ? (
          <button type="button" onClick={entrar}
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[hsl(var(--primary)/0.88)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 md:h-8">
            <Pencil className="size-3.5" aria-hidden /> Editar
          </button>
        ) : (
          <p className="flex h-11 items-center text-[13px] text-muted-foreground md:h-8">Modo edição · campos calculados ficam bloqueados</p>
        )}
        {!editando && (
          <>
            <LinkBtn label="Abrir no quadro ↗" link={{ url: urlItem(p.id) }} />
            <LinkBtn label="Abrir quadro do planejamento" link={p.quadroDoPlanejamento} />
            <LinkBtn label="Painel SGI" link={p.painelSgi} />
            <LinkBtn label="Planilha Planejamento" link={p.planilhaPlanejamento} />
          </>
        )}
      </div>

      {editando ? (
        <>
          {atualizadoFora && (
            <div className="mx-5 mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-xs text-foreground">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0 text-[hsl(var(--warning))]" aria-hidden /> Este projeto foi atualizado no quadro
              </span>
              <button type="button" onClick={recarregar}
                className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 font-medium text-foreground hover:bg-[hsl(var(--surface-3))] md:h-7">
                <RotateCw className="size-3.5" aria-hidden /> Recarregar
              </button>
            </div>
          )}
          <ProjectEditForm projeto={p} draft={draft} setDraft={setDraft} edicao={edicao} />
          <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t border-border bg-[hsl(var(--surface-chrome))] px-5 py-3">
            <span className="tnum text-xs text-muted-foreground">{qtd ? `${qtd} campo${qtd === 1 ? '' : 's'} alterado${qtd === 1 ? '' : 's'}` : 'Nenhuma alteração'}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditando(false)} disabled={salvando}
                className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input px-3 text-[13px] text-foreground hover:bg-[hsl(var(--surface-3))] disabled:opacity-50 md:h-8">
                <X className="size-3.5" aria-hidden /> Cancelar
              </button>
              <button type="button" onClick={onSalvar} disabled={salvando || !qtd}
                className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--primary)/0.88)] disabled:opacity-50 md:h-8">
                {salvando ? <Spinner className="size-3.5" /> : <Save className="size-3.5" aria-hidden />} Salvar
              </button>
            </div>
          </div>
        </>
      ) : (
        <ProjectView p={p} />
      )}

      <ConfirmSave open={!!pendente} campos={pendente ? camposAlterados(pendente) : []}
        onCancel={() => setPendente(null)} onConfirm={() => pendente && void gravar(pendente)} />
    </>
  );
}

export function ProjectSheet({ projeto, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!projeto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-[hsl(var(--surface-chrome))] p-0 shadow-none sm:max-w-xl">
        {projeto && <Corpo key={projeto.id} p={projeto} {...rest} />}
      </SheetContent>
    </Sheet>
  );
}
