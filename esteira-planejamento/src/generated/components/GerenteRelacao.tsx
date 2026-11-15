import { useState } from 'react';
import { Check, ChevronDown, Unlink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command';
import { Spinner } from '@components/ui/spinner';
import { cn } from '@lib/utils';
import type { Projeto } from '@generated/lib/format';
import { type Draft, relAlterada, ddAlvoDaRelacao, ddDivergeDaRelacao } from '@generated/lib/edicao';
import type { GerenteOpcao } from '@generated/hooks/useOpcoesEdicao';

interface Props {
  projeto: Projeto;
  draft: Draft;
  setDraft: (d: Draft) => void;
  gerentes: GerenteOpcao[] | null;
  loading: boolean;
  ddOpts: string[];
  id: string;
}

/** Searchable single choice for the "Gerente" relation + option to align the dropdown. */
export function GerenteRelacao({ projeto, draft, setDraft, gerentes, loading, ddOpts, id }: Props) {
  const [open, setOpen] = useState(false);
  const lista = gerentes ?? [];
  const ids = new Set(lista.map((g) => g.id));
  // Keep currently linked items visible even if they are not GERENTE in the Mapa.
  const foraDoCadastro = (projeto.gerente?.linkedItems ?? [])
    .map((i) => ({ id: String(i.id), name: i.name ?? '' }))
    .filter((g) => !ids.has(g.id));
  const alterado = relAlterada(projeto, draft);
  const diverge = alterado && ddDivergeDaRelacao(draft, ddOpts);
  const alvo = ddAlvoDaRelacao(draft, ddOpts);
  const escolher = (g: GerenteOpcao | null) => {
    setDraft({ ...draft, rel: g ? [g] : [] });
    setOpen(false);
  };
  const atual = draft.rel.map((r) => r.name).join(', ');

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={`${id}-label`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Gerente (relação com o Mapa de Gerentes)
        {alterado && <span className="size-1.5 rounded-full bg-primary" aria-label="alterado" />}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" aria-labelledby={`${id}-label ${id}`}
            className={cn('inline-flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-left text-base md:h-8 md:text-[13px]',
              'hover:bg-[hsl(var(--surface-3))] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20')}>
            <span className={cn('min-w-0 truncate', atual ? 'text-foreground' : 'text-[hsl(var(--fg-subtle))]')}>{atual || 'Sem gerente vinculado'}</span>
            {loading ? <Spinner className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 rounded-[var(--radius-lg)] border-border p-0 shadow-none">
          <Command>
            <CommandInput placeholder="Buscar gerente…" className="text-[13px]" />
            <CommandList className="max-h-64">
              <CommandEmpty>{loading ? 'Carregando gerentes…' : gerentes === null ? 'Não foi possível ler o Mapa de Gerentes.' : 'Nenhum gerente encontrado.'}</CommandEmpty>
              <CommandGroup heading="Mapa · Atividade GERENTE">
                {lista.map((g) => (
                  <CommandItem key={g.id} value={`${g.name} ${g.id}`} onSelect={() => escolher(g)} className="gap-2 text-[13px]">
                    <Check className={cn('size-3.5 shrink-0', draft.rel.some((r) => r.id === g.id) ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <span className="truncate">{g.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {foraDoCadastro.length > 0 && (
                <CommandGroup heading="Vínculo atual (fora do cadastro GERENTE)">
                  {foraDoCadastro.map((g) => (
                    <CommandItem key={g.id} value={`${g.name} ${g.id}`} onSelect={() => escolher(g)} className="gap-2 text-[13px]">
                      <Check className={cn('size-3.5 shrink-0', draft.rel.some((r) => r.id === g.id) ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <span className="truncate">{g.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            {draft.rel.length > 0 && (
              <div className="border-t border-border p-1">
                <button type="button" onClick={() => escolher(null)}
                  className="flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Unlink className="size-3" aria-hidden /> Remover vínculo
                </button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {diverge && (
        <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-border bg-[hsl(var(--surface-2))] px-2.5 py-2 text-[13px] text-foreground">
          <input type="checkbox" checked={draft.syncDd} onChange={(e) => setDraft({ ...draft, syncDd: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]" />
          <span className="min-w-0">
            Atualizar também o dropdown Gerente
            <span className="block text-[11px] text-muted-foreground">
              Hoje: {draft.dds.gerente1.join(', ') || '—'} → ficará: {alvo.join(', ') || '—'}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
