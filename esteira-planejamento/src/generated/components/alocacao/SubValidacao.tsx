import { TabelaScroll } from '@generated/components/TabelaScroll';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@lib/utils';
import { piscar } from '@generated/components/fx/motion';
import { ArrowRight, FileText, Info, Undo2 } from 'lucide-react';
import { vibeQueryClient } from '@vibe/db/client';
import { Q_ACOES } from '@generated/hooks/useAlocacao';
import { registrarRelatorio } from '@generated/server/acoes';
import { gerarRelatorio, linhaValidacao } from '@generated/lib/relatorio';
import { InfoDica } from '@generated/components/ui-bits';
import { RelatorioDialog } from '@generated/components/alocacao/RelatorioDialog';
import { ValidacaoLinha } from '@generated/components/alocacao/ValidacaoLinha';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@components/ui/alert-dialog';
import { Spinner } from '@components/ui/spinner';
import { codigoDe } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';
import { nomesGerentesDe } from '@generated/lib/carga';
import { type Destino, casaDestino, rotuloDestino, tipoDe, TIPO_LABEL } from '@generated/lib/alocacao';
import { gravarAlocacao } from '@generated/server/projetos';
import { NomeLink } from '@generated/components/NomeLink';
import { EmptyState } from '@generated/components/ui-bits';
import { quando } from '@generated/components/alocacao/bits';
import { Secao, Th, tabelaCls, theadCls, useOrdenacao } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { TipoTag } from '@generated/components/alocacao/DestinoGerentes';

/** The "Gerente" dropdown of the 02.01 accepts at most 3 labels. */
const LIMITE_DD = 3;

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function SubValidacao({ ctx }: { ctx: AlocCtx }) {
  const { modelo, dados, api, q } = ctx;
  const pendentes = useMemo(() => modelo.todos.filter((d) => d.projecoes.length > 0 && casaDestino(q, d)), [modelo.todos, q]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [rodando, setRodando] = useState(false);
  const selecionados = pendentes.filter((d) => sel.has(d.p.id));
  const linhas = useMemo(() => new Map(pendentes.map((d) => [d.p.id, linhaValidacao(modelo, d)])), [pendentes, modelo]);
  const { ordenadas, sort, setSort } = useOrdenacao(pendentes, {
    gerentes: (d: Destino) => d.projecoes.map((x) => rotuloDestino(x.data)).sort().join(', '),
    projeto: (d: Destino) => d.p.name,
    chegada: (d: Destino) => linhas.get(d.p.id)?.chegada.inicio?.getTime() ?? null,
    status: (d: Destino) => (linhas.get(d.p.id)?.sobreposicaoAte ? 0 : 1),
    tipo: (d: Destino) => d.projecoes.map((x) => TIPO_LABEL[tipoDe(x.data)]).sort().join(', '),
  }, { key: 'chegada', dir: 'asc' });
  const [relatorio, setRelatorio] = useState<{ texto: string; n: number } | null>(null);
  /** Report over the selected rows, or over every row currently shown (search applied) when none is selected. */
  const gerar = async () => {
    const alvo = selecionados.length ? ordenadas.filter((d) => sel.has(d.p.id)) : ordenadas;
    const texto = gerarRelatorio(modelo, alvo);
    setRelatorio({ texto, n: alvo.length });
    try {
      await registrarRelatorio({ data: { descricao: `Relatório de validação gerado: ${alvo.length} projeto(s) — ${alvo.slice(0, 6).map((d) => codigoDe(d.p) ?? d.p.name).join('; ')}${alvo.length > 6 ? '…' : ''}`.slice(0, 600), itens: alvo.length } });
      void vibeQueryClient.invalidateQueries({ queryKey: ['vibedb', ...Q_ACOES] });
    } catch (e) {
      console.error('Falha ao registrar o relatório', e);
      toast.warning('Relatório gerado, mas não foi registrado no Registro de ações.');
    }
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const recentes = useMemo(() => {
    const porProjeto = new Map<string, typeof dados.projecoes>();
    for (const x of dados.projecoes) if (x.data.status === 'Validada') porProjeto.set(x.data.projetoId, [...(porProjeto.get(x.data.projetoId) ?? []), x]);
    return [...porProjeto.values()]
      .map((xs) => ({ xs, em: xs.map((x) => x.data.validadoEm).sort().pop() ?? '' }))
      .sort((a, b) => b.em.localeCompare(a.em))
      .slice(0, 20);
  }, [dados.projecoes]);

  const validar = async () => {
    setRodando(true);
    const falhas: string[] = [];
    const acoes: string[] = [];
    const avisos: string[] = [];
    let ok = 0;
    let gravouNoMonday = false;
    let releituraFalhou = false;
    for (const d of selecionados) {
      try {
        const gers = d.projecoes.filter((x) => x.data.destinoTipo === 'gerente');
        if (gers.length) {
          const ids = [...new Set(gers.map((x) => x.data.gerenteId))];
          const labels = [...new Set(gers.map((x) => ctx.ddGerenteOpts.find((o) => normNome(o) === normNome(x.data.gerenteNome)) ?? x.data.gerenteNome.trim()))];
          // Reforço ADDS to the current relation/dropdown; Troca and Novo REPLACE them.
          const modo = d.comGerente && !d.projecoes.some((x) => tipoDe(x.data) === 'troca') ? 'adicionar' : 'substituir';
          if (ids.length > LIMITE_DD || labels.length > LIMITE_DD) {
            throw new Error(`mais de ${LIMITE_DD} gerentes projetados — o dropdown Gerente aceita no máximo ${LIMITE_DD}. Remova uma projeção e valide de novo.`);
          }
          // Relation + dropdown + Alocação Gerente in a single write: on failure nothing is written and it stays Pendente.
          const res = await gravarAlocacao({ data: { id: d.p.id, gerenteIds: ids, labels, data: hojeIso(), modo } });
          gravouNoMonday = true;
          if (res?.item) ctx.onItem(res.item);
          else releituraFalhou = true;
          if (res?.avisoDropdown) avisos.push(`${codigoDe(d.p) ?? d.p.name}: ${res.avisoDropdown}`);
        }
        const gravou = await api.mudarStatus(d.projecoes.map((x) => x.id), 'Validada', true, (a) => acoes.push(a.id));
        if (!gravou) throw new Error(gers.length ? 'gravado no 02.01, mas o status no app continua Pendente — valide de novo' : 'status no app não atualizado');
        ok++;
        piscar(d.p.id);
      } catch (e) {
        console.error('Falha ao validar alocação', d.p.id, e);
        falhas.push(`${codigoDe(d.p) ?? d.p.name}: ${e instanceof Error ? e.message : 'erro'}`);
      }
    }
    setRodando(false);
    // After writing to 02.01, always read the base fresh (also covers an item that couldn't be re-read).
    if (gravouNoMonday || releituraFalhou) ctx.recarregarBase();
    setConfirmar(false);
    setSel(new Set());
    // Undo of the whole batch: status back to Pendente in the app only (02.01 is not reverted).
    const desfazerLote = async () => {
      let n = 0;
      let aviso: string | null = null;
      for (const id of [...acoes].reverse()) {
        const r = await api.desfazer(id, true);
        if (r.ok) { n++; aviso = aviso ?? r.aviso; }
      }
      if (n) toast.success(`${n} validação(ões) desfeita(s) — status de volta a Pendente no app`);
      if (aviso) toast.warning(aviso, { duration: 12000 });
    };
    if (avisos.length) toast.warning(`Dropdown Gerente não atualizado em ${avisos.length} projeto(s)`, { description: avisos.join('\n'), duration: 15000 });
    const acao = acoes.length ? { label: 'Desfazer', onClick: () => void desfazerLote() } : undefined;
    if (falhas.length) toast.error(`${ok} validada(s) · ${falhas.length} não validada(s)`, { description: `Continuam pendentes:\n${falhas.join('\n')}`, duration: 15000, action: acao });
    else toast.success(`${ok} alocação(ões) validada(s)`, { description: 'Gerente e Alocação Gerente gravados no 02.01 (CDPE, externo e Novo gerente só no app).', duration: 8000, action: acao });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info-soft))] px-3 py-2.5 text-[13px] text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-[hsl(var(--info))]" aria-hidden />
        Selecione as alocações que deseja validar. As projeções não selecionadas permanecerão salvas até serem validadas ou removidas manualmente. Ao confirmar, os projetos validados serão adicionados ao histórico do gerente e removidos da lista de destinos.
      </p>

      <Secao titulo={`Alocações pendentes (${pendentes.length})`} aside={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={() => setSel(new Set(pendentes.map((d) => d.p.id)))} disabled={!pendentes.length} className="h-11 rounded-[var(--radius-md)] border border-input px-2.5 hover:bg-accent disabled:opacity-50 md:h-8">Selecionar todos</button>
          <button type="button" onClick={() => setSel(new Set())} disabled={!sel.size} className="h-11 rounded-[var(--radius-md)] border border-input px-2.5 hover:bg-accent disabled:opacity-50 md:h-8">Limpar seleção</button>
          <span className="tnum text-muted-foreground">{selecionados.length} de {pendentes.length} alocação(ões) selecionada(s)</span>
          <button type="button" onClick={() => void gerar()} disabled={!pendentes.length}
            title={selecionados.length ? 'Relatório das linhas selecionadas' : 'Relatório de todas as linhas exibidas (busca aplicada)'}
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input px-2.5 hover:bg-accent disabled:opacity-50 md:h-8">
            <FileText className="size-3.5" aria-hidden /> Gerar relatório{selecionados.length ? ` (${selecionados.length})` : ''}
          </button>
          <button type="button" onClick={() => setConfirmar(true)} disabled={!selecionados.length || rodando}
            className={cn('relative h-11 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-3))] px-3 font-medium text-foreground hover:bg-[hsl(var(--surface-2))] disabled:opacity-50 md:h-8', selecionados.length > 0 && !rodando && '')}>
            Validar selecionadas
          </button>
        </div>
      }>
        {pendentes.length === 0 ? <EmptyState title="Nenhuma alocação pendente" hint="Projete gerentes nas sub-abas “Esteira de Projetos” ou “Projetos destino”." /> : (
          <TabelaScroll>
            <p className="px-3 pb-1.5 text-[11px] text-[hsl(var(--fg-subtle))]">R = capacidade ou eixos revisados manualmente</p>
            <table className={tabelaCls}>
              <thead className={theadCls}>
                <tr>
                  <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Selecionar</span></th>
                  <Th k="projeto" label="Projeto que vai chegar" sort={sort} setSort={setSort} />
                  <Th k="gerentes" label="Gerente a alocar" sort={sort} setSort={setSort} />
                  <Th k="tipo" label="Tipo" sort={sort} setSort={setSort} />
                  <Th k="chegada" label="Chegada prevista" sort={sort} setSort={setSort} />
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    <span className="inline-flex items-center gap-1">Outros projetos ativos do gerente <InfoDica texto="Projetos ativos do gerente (coluna Gerente do 02.01) com o Último Produto Previsto como término. Em vermelho: término depois da chegada prevista do projeto novo (sobreposição)." /></span>
                  </th>
                  <Th k="status" label="Situação" sort={sort} setSort={setSort} />
                  <th scope="col" className="w-8 px-1 py-2"><span className="sr-only">Revisado manualmente</span></th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((d) => {
                  const l = linhas.get(d.p.id);
                  return l ? <ValidacaoLinha key={d.p.id} ctx={ctx} l={l} marcado={sel.has(d.p.id)} onToggle={() => toggle(d.p.id)} /> : null;
                })}
              </tbody>
            </table>
          </TabelaScroll>
        )}
      </Secao>

      <Secao titulo={`Validadas recentemente (${recentes.length})`}>
        {recentes.length === 0 ? <EmptyState title="Nenhuma validação ainda" hint="As alocações validadas aparecem aqui." /> : (
          <ul className="divide-y divide-border">
            {recentes.map(({ xs, em }) => {
              const x0 = xs[0];
              const p = x0 ? modelo.porId.get(x0.data.projetoId) : undefined;
              return (
                <li key={x0?.data.projetoId} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 basis-60">{p ? <NomeLink p={p} /> : x0?.data.projetoNome}</span>
                  <span className="text-muted-foreground">{xs.map((x) => rotuloDestino(x.data)).join(', ')}</span>
                  <span className="text-xs text-[hsl(var(--fg-subtle))]">{x0?.data.validadoPor} · {quando(em)}</span>
                  <button type="button" onClick={() => void api.mudarStatus(xs.map((x) => x.id), 'Pendente')}
                    title="Volta a projeção para Pendente no app (o que já foi gravado no 02.01 não é alterado)"
                    className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground md:h-7">
                    <Undo2 className="size-3.5" aria-hidden /> Desfazer status
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <RelatorioDialog texto={relatorio?.texto ?? null} n={relatorio?.n ?? 0} onClose={() => setRelatorio(null)} />

      <AlertDialog open={confirmar} onOpenChange={(o) => !rodando && setConfirmar(o)}>
        <AlertDialogContent className="max-w-2xl rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Validar {selecionados.length} alocação(ões)?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Para gerentes cadastrados, o 02.01 recebe a relação “Gerente” (dropdown sincronizado, máx. 3) e “Alocação Gerente” = hoje: Novo e Troca substituem os gerentes atuais; Reforço adiciona aos atuais. CDPE (interno), externo e Novo gerente só mudam o status no app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-[var(--radius-md)] border border-border">
            {selecionados.map((d) => <LinhaConfirmacao key={d.p.id} d={d} />)}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rodando}>Voltar</AlertDialogCancel>
            <button type="button" onClick={() => void validar()} disabled={rodando}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-3))] px-4 text-[13px] font-medium text-foreground hover:bg-[hsl(var(--surface-2))] disabled:opacity-60 md:h-9">
              {rodando && <Spinner className="size-3.5" />} Confirmar validação
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinhaConfirmacao({ d }: { d: Destino }) {
  const atual = nomesGerentesDe(d.p).map((g) => g.nome);
  const soApp = d.projecoes.every((x) => x.data.destinoTipo !== 'gerente');
  const reforco = d.comGerente && !d.projecoes.some((x) => tipoDe(x.data) === 'troca');
  const novos = d.projecoes.filter((x) => x.data.destinoTipo === 'gerente').map((x) => x.data.gerenteNome);
  const resultado = soApp ? d.projecoes.map((x) => rotuloDestino(x.data))
    : reforco ? [...new Map([...atual, ...novos].map((n) => [normNome(n), n])).values()] : novos;
  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-[13px]">
      <span className="flex min-w-0 items-center gap-1.5">
        {[...new Set(d.projecoes.map((x) => tipoDe(x.data)))].map((t) => <TipoTag key={t} tipo={t} />)}
        <span className="truncate font-medium text-foreground" title={d.p.name}>{codigoDe(d.p) ? `${codigoDe(d.p)} · ` : ''}{d.p.name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{atual.length ? atual.join(', ') : 'Sem vínculo'}</span>
        <ArrowRight className="size-3" aria-hidden />
        <span className="text-foreground">{resultado.join(', ')}</span>
        {!soApp && resultado.length > 3 && <span className="text-[hsl(var(--danger))]">(mais de 3 — não será validado)</span>}
        {soApp && <span className="text-[hsl(var(--fg-subtle))]">(só no app)</span>}
      </span>
    </li>
  );
}
