import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { cn } from '@lib/utils';
import { type Destino, type TipoProjecao, rotuloDestino, tipoDe, experienciaTexto, CAP_COR, LIMITE_DESTINOS, NOVO_GERENTE, TIPO_LABEL } from '@generated/lib/alocacao';
import type { AlocProjecao } from '@generated/models';
import type { Doc } from '@generated/lib/alocacao';
import { BuscaCombo, btnAdd, type ComboItem } from '@generated/components/alocacao/bits';
import { CHIP, DOT } from '@generated/components/alocacao/cores';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { naoConfirmado } from '@generated/hooks/useAlocacao';

const ID_CDPE = '__cdpe';
const ID_EXTERNO = '__externo';
const ID_NOVO = '__novo';

const chaveDe = (x: AlocProjecao) => (x.destinoTipo === 'gerente' ? x.gerenteId : x.destinoTipo === 'cdpe' ? ID_CDPE : x.destinoTipo === 'externo' ? ID_EXTERNO : ID_NOVO);

/** Options for a destination: CDPE, external, the single "Novo gerente" and managers (alphabetical). */
export function opcoesDestino(ctx: AlocCtx, d: Destino): ComboItem[] {
  const ja = new Set(d.projecoes.map((x) => chaveDe(x.data)));
  const naRelacao = new Set((d.p.gerente?.linkedItems ?? []).map((li) => String(li.id)));
  const nNovo = ctx.modelo.novoGerente.projetos;
  const especiais: ComboItem[] = [
    { id: ID_CDPE, label: 'CDPE (interno)', grupo: 'Opções especiais' },
    { id: ID_EXTERNO, label: `${ctx.modelo.externo.nome} (externo)`, grupo: 'Opções especiais' },
    { id: ID_NOVO, label: NOVO_GERENTE, sub: `contratação · ${nNovo} projeto(s) com novo gerente`, grupo: 'Opções especiais' },
  ];
  const gerentes = ctx.modelo.gerentes.map((g) => {
    const cheio = g.projecoes.length >= LIMITE_DESTINOS;
    const noProjeto = naRelacao.has(g.g.id) || g.g.itemIds.some((i) => naRelacao.has(i));
    return {
      id: g.g.id, label: g.g.nome, grupo: 'Gerentes', desabilitado: cheio,
      marca: cheio ? `limite de ${LIMITE_DESTINOS}` : noProjeto ? 'já no 02.01' : undefined,
      sub: `${g.cap.valor} · ${g.ativos.length} ativo(s) · ${g.projecoes.length}/${LIMITE_DESTINOS} destinos${g.eixos.valor.length ? ` · ${g.eixos.valor.join(', ')}` : ''}`,
      detalhe: experienciaTexto(g, d.p) ?? undefined,
    };
  });
  return [...especiais, ...gerentes].filter((i) => !ja.has(i.id));
}

function paraProjecao(ctx: AlocCtx, d: Destino, i: ComboItem, tipo: TipoProjecao) {
  const base = { projetoId: d.p.id, projetoNome: d.p.name, tipo };
  if (i.id === ID_CDPE) return { ...base, destinoTipo: 'cdpe' as const, gerenteId: '', gerenteNome: '' };
  if (i.id === ID_EXTERNO) return { ...base, destinoTipo: 'externo' as const, gerenteId: ctx.modelo.externo.id, gerenteNome: ctx.modelo.externo.nome };
  if (i.id === ID_NOVO) return { ...base, destinoTipo: 'novo' as const, gerenteId: 'novo', gerenteNome: NOVO_GERENTE };
  return { ...base, destinoTipo: 'gerente' as const, gerenteId: i.id, gerenteNome: i.label };
}

/**
 * Assigns (or replaces) a destination; asks for confirmation when the project already has projections.
 * Tipo: projects without a manager in the 02.01 → Novo; with a manager → Reforço (default) or Troca.
 */
export async function projetarItem(ctx: AlocCtx, d: Destino, i: ComboItem, substituir?: Doc<AlocProjecao>, tipo?: TipoProjecao) {
  const t: TipoProjecao = !d.comGerente ? 'novo' : tipo ?? (substituir ? tipoDe(substituir.data) : 'reforco');
  const outros = d.projecoes.filter((x) => x.id !== substituir?.id);
  if (outros.length) {
    const ok = await ctx.perguntar({
      titulo: 'Projeto já atribuído',
      texto: `Este projeto já foi atribuído a ${outros.map((x) => rotuloDestino(x.data)).join(', ')}. Deseja prosseguir?`,
    });
    if (!ok) return false;
  }
  return ctx.api.projetar(paraProjecao(ctx, d, i, t === 'novo' && d.comGerente ? 'reforco' : t), substituir?.id);
}

export function TipoTag({ tipo }: { tipo: TipoProjecao }) {
  return (
    <span className={cn('rounded-[var(--radius-sm)] border px-1 text-[10px] font-medium uppercase tracking-wide',
      tipo === 'troca' ? CHIP['--temp-mudanca'] : tipo === 'reforco' ? CHIP['--temp-reforco'] : CHIP['--temp-sem'])}>
      {TIPO_LABEL[tipo]}
    </span>
  );
}

/** Chips of the projected destinations (click to swap, x to remove) + pickers (Atribuir, or Reforço / Troca when already allocated). */
export function DestinoGerentes({ ctx, d, semTags = false }: { ctx: AlocCtx; d: Destino; semTags?: boolean }) {
  const capDe = new Map(ctx.modelo.gerentes.map((g) => [g.g.id, g.cap.valor]));
  const opcoes = opcoesDestino(ctx, d);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {!semTags && d.aguardandoSync && (
        <span className={cn('inline-flex h-7 items-center rounded-[var(--radius-sm)] border px-1.5 text-[11px]', CHIP['--temp-30'])}
          title="A validação já foi gravada; o 02.01 ainda não mostra o gerente. Use “Recarregar do monday” se demorar.">
          Validado, aguardando sincronizar com o 02.01
        </span>
      )}
      {!semTags && d.gerenteJaNo0201 && (
        <span className={cn('inline-flex h-7 items-center rounded-[var(--radius-sm)] border px-1.5 text-[11px]', CHIP['--farol-gray'])}
          title="O gerente desta projeção já está na relação Gerente do 02.01; valide para registrar no app.">
          Gerente já no 02.01 · falta validar
        </span>
      )}
      {d.projecoes.map((x) => {
        const cap = x.data.destinoTipo === 'gerente' ? capDe.get(x.data.gerenteId) : undefined;
        return (
          <span key={x.id} className={cn('inline-flex h-7 max-w-full items-center gap-1 rounded-[var(--radius-sm)] border pl-1 text-xs',
            x.data.destinoTipo === 'gerente' ? 'border-border bg-[hsl(var(--surface-2))] text-foreground' : CHIP['--farol-gray'])}>
            {cap && <span className={cn('ml-0.5 size-1.5 shrink-0 rounded-full', DOT[CAP_COR[cap]])} aria-hidden />}
            {!semTags && d.comGerente && <TipoTag tipo={tipoDe(x.data)} />}
            <BuscaCombo itens={opcoes} placeholder="Trocar por…" onPick={(i) => void projetarItem(ctx, d, i, x)}
              gatilho={
                <button type="button" disabled={naoConfirmado(x.id)} title={naoConfirmado(x.id) ? 'Salvando…' : `Trocar · projetado por ${x.data.autor}${cap ? ` · capacidade ${cap}` : ''}`}
                  className="max-w-[200px] truncate rounded-[var(--radius-sm)] px-0.5 hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {rotuloDestino(x.data)}
                </button>
              } />
            <button type="button" onClick={() => void ctx.api.desprojetar(x.id)} aria-label={`Remover ${rotuloDestino(x.data)} de ${d.p.name}`}
              disabled={naoConfirmado(x.id)} title={naoConfirmado(x.id) ? 'Salvando…' : undefined}
              className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:text-foreground disabled:opacity-40">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        );
      })}
      {d.comGerente ? (
        <>
          <BuscaCombo itens={opcoes} onPick={(i) => void projetarItem(ctx, d, i, undefined, 'reforco')} placeholder="Gerente de reforço…"
            gatilho={<button type="button" className={btnAdd} title="Adiciona um gerente aos que já estão no 02.01 (na Validação)"><Plus className="size-3" aria-hidden /> Reforço</button>} />
          <BuscaCombo itens={opcoes} onPick={(i) => void projetarItem(ctx, d, i, undefined, 'troca')} placeholder="Novo gerente do projeto…"
            gatilho={<button type="button" className={btnAdd} title="Substitui o gerente do 02.01 (na Validação)"><ArrowLeftRight className="size-3" aria-hidden /> Troca</button>} />
        </>
      ) : (
        <BuscaCombo itens={opcoes} onPick={(i) => void projetarItem(ctx, d, i)} placeholder="Buscar gerente…"
          gatilho={<button type="button" className={btnAdd}><Plus className="size-3" aria-hidden /> {d.projecoes.length ? 'Adicionar' : 'Atribuir'}</button>} />
      )}
    </span>
  );
}

/** Experience of a manager for this project (eixo / UF), from their active + closed projects in the 02.01. */
export function ExperienciaGerente({ ctx, gerenteId, d, className }: { ctx: AlocCtx; gerenteId: string; d: Destino; className?: string }) {
  const ga = [...ctx.modelo.gerentes, ...ctx.modelo.desativados].find((g) => g.g.id === gerenteId);
  const txt = ga ? experienciaTexto(ga, d.p) : null;
  if (!txt) return null;
  return <span className={cn('block text-[11px] leading-snug text-muted-foreground', className)}>{txt}</span>;
}

/** One line per projected manager with their experience (side panel of the Esteira de Projetos). */
export function ExperienciaProjetados({ ctx, d }: { ctx: AlocCtx; d: Destino }) {
  const gers = d.projecoes.filter((x) => x.data.destinoTipo === 'gerente');
  if (!gers.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {gers.map((x) => (
        <li key={x.id} className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{x.data.gerenteNome}</span>
          <ExperienciaGerente ctx={ctx} gerenteId={x.data.gerenteId} d={d} />
        </li>
      ))}
    </ul>
  );
}

