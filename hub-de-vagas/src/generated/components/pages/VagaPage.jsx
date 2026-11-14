import { useState } from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { Pill, PessoaName } from '@generated/components/Pill';
import { PageHeader, Facts, Tabs, TextBlock, TagBlock, BlockSkeleton } from '@generated/components/pages/PageBits';
import { useItemDetails, VAGA_DETAIL_COLS } from '@generated/hooks/useItemDetails';
import { fmtDate } from '@generated/lib/data';
import { canon, clean } from '@generated/lib/normalize';
import { COLORS } from '@generated/lib/colors';
import { daysSince, isOne } from '@generated/lib/dates';
import { RoundAge, InterviewAge, VagaAge, SemDadosBadge } from '@generated/components/Age';
import { EditableStatus, EditableDate, EditableText, useEditable } from '@generated/components/edit/Editable';
import { DragBoard, Draggable, DropZone } from '@generated/components/edit/Dnd';
import { useEdit } from '@generated/components/edit/EditProvider';
import { cn } from '@lib/utils';

function MatchCard({ m, onClick }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }} className="flex w-full cursor-pointer flex-col gap-2 rounded-md border border-border bg-card p-3 text-left transition-shadow hover:shadow-[var(--glow-stack)] lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2 text-sm font-medium"><PessoaName match={m} /></div>
      <div className="flex flex-wrap gap-1"><RoundAge match={m} /><InterviewAge match={m} /><SemDadosBadge m={m} /></div>
      <EditableStatus item={m} fieldKey="statusDoMatch" />
      {clean(m.resultadoDaRodada) && <p className="line-clamp-2 text-xs text-muted-foreground" title={canon(m.resultadoDaRodada)}>{canon(m.resultadoDaRodada)}</p>}
      {clean(m.prximaAo) && <p className="line-clamp-2 text-xs" title={m.prximaAo}><span className="text-muted-foreground">Próxima ação: </span>{m.prximaAo}</p>}
    </div>
  );
}

export default function VagaPage({ vaga, crumbs, onBack, openPerfil, openMatch, byId }) {
  const [tab, setTab] = useState('pessoas');
  const det = useItemDetails(vaga.id, VAGA_DETAIL_COLS);
  const d = det.item ?? {};
  const open = isOne(vaga.vagaEmAberto);
  const atraso = open ? daysSince(vaga.dataDeIncioPrevista) : null;
  const abertaDias = open ? daysSince(d.dataDeAberturaDaVaga ?? vaga.createdAt) : null;
  const rodadas = Object.keys(COLORS.rodada);
  const cols = [...rodadas.map((r) => ({ r, list: vaga._matches.filter((m) => canon(m.rodada) === r) })),
    { r: 'Sem rodada', list: vaga._matches.filter((m) => !rodadas.includes(canon(m.rodada))) }].filter((c, i) => i < 4 || c.list.length);
  const { edit, closeVaga, canFor, editMode } = useEdit();
  const dragOn = useEditable('rodada', vaga._matches[0]).active;
  const onMatch = (m) => (m._perfilId && byId[m._perfilId]?.type === 'perfil' ? openPerfil(m._perfilId) : openMatch(m));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumbs={crumbs} onBack={onBack} itemId={vaga.id} itemType="vaga" eyebrow="Ficha da vaga" title={vaga.name}>
        <div className="flex flex-wrap items-center gap-2"><VagaAge vaga={{ ...vaga, dataDeAberturaDaVaga: vaga.dataDeAberturaDaVaga ?? d.dataDeAberturaDaVaga }} /><EditableStatus item={vaga} fieldKey="statusDaVaga" /><EditableStatus item={vaga} fieldKey="prioridadeDaVaga" /><Pill fieldKey="senioridadeVaga" label={vaga.senioridadeVaga} /><Pill fieldKey="etapaEsteira" label={vaga._etapa} />
          {!vaga._alocada && editMode && canFor('vaga') && (
            <button onClick={() => closeVaga(vaga)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/50 bg-accent/40 px-4 text-sm font-medium hover:border-primary"><CheckCircle2 className="h-4 w-4" />Fechar vaga</button>
          )}</div>
        {vaga._alocada && <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Vaga fechada (realocação ou contratação concluída) — ela não aparece mais nas listas do app.</p>}
        <Facts items={[
          { label: 'Código', value: String(vaga.id) },
          { label: 'Projeto', value: clean(vaga.projeto) },
          { label: 'Cargo / Papel', value: clean(vaga.cargoPapel) },
          { label: 'Início previsto', value: vaga.dataDeIncioPrevista ? <EditableDate item={vaga} fieldKey="dataDeIncioPrevista" /> : <span className="flex items-center gap-2"><EditableDate item={vaga} fieldKey="dataDeIncioPrevista" /><span className="text-xs text-muted-foreground">Sem data</span></span> },
          atraso != null && atraso > 0 ? { label: 'Atraso', value: `${atraso} dias`, tone: 'danger' } : { label: 'Em aberto há', value: abertaDias != null ? `${abertaDias} dias` : (open ? '—' : 'Vaga fechada') },
        ]} />
      </PageHeader>

      <section>
        <h2 className="mb-3 text-sm font-medium">Funil de rodadas <span className="text-muted-foreground">· {vaga._matches.length} pessoas</span></h2>
        {vaga._matches.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground"><Users className="h-5 w-5" /> Nenhuma pessoa em match nesta vaga ainda.</div>
        ) : (
          <DragBoard enabled={dragOn} onMove={(m, to) => edit('match', m, 'rodada', to === 'Sem rodada' ? null : to)} renderOverlay={(m) => <MatchCard m={m} onClick={() => {}} />}>
          {dragOn && <p className="mb-2 text-xs text-muted-foreground">Arraste uma pessoa entre as colunas para mudar a rodada.</p>}
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {cols.map((c) => (
              <DropZone key={c.r} id={c.r} enabled={dragOn} className="w-[80vw] max-w-[300px] shrink-0 snap-start rounded-md border border-border bg-muted/40 p-2 transition-shadow lg:w-auto lg:max-w-none">
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium"><span>{c.r}</span><span className="tabular-nums text-muted-foreground">{c.list.length}</span></div>
                <div className="flex flex-col gap-2">
                  {c.list.length ? c.list.map((m) => <Draggable key={m.id} id={m.id} item={m} column={c.r} enabled={dragOn}><MatchCard m={m} onClick={() => onMatch(m)} /></Draggable>) : <p className="px-1 py-4 text-center text-xs text-muted-foreground">{dragOn ? 'Solte aqui' : '—'}</p>}
                </div>
              </DropZone>
            ))}
          </div>
          </DragBoard>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <Tabs active={tab} onChange={setTab} tabs={[{ id: 'pessoas', label: 'Pessoas', count: vaga._matches.length }, { id: 'detalhes', label: 'Detalhes da vaga' }, { id: 'obs', label: 'Observações' }]} />
        {tab === 'pessoas' && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{['Pessoa', 'Rodada', 'Status do Match', 'Resultado', 'Envio do card', 'Entrevista', 'Próxima ação'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {vaga._matches.map((m) => (
                  <tr key={m.id} onClick={() => onMatch(m)} className="cursor-pointer hover:bg-accent/40">
                    <td className="max-w-[220px] px-3 py-2 font-medium"><PessoaName match={m} /></td>
                    <td className="px-3 py-2"><EditableStatus item={m} fieldKey="rodada" /></td>
                    <td className="px-3 py-2"><EditableStatus item={m} fieldKey="statusDoMatch" /></td>
                    <td className="px-3 py-2"><EditableStatus item={m} fieldKey="resultadoDaRodada" /></td>
                    <td className="px-3 py-2 tabular-nums"><span className="flex flex-col items-start gap-1"><EditableDate item={m} fieldKey="dataDeEnvioDoCard" /><RoundAge match={m} /></span></td>
                    <td className="px-3 py-2 tabular-nums"><span className="flex flex-col items-start gap-1"><EditableDate item={m} fieldKey="dataDaEntrevista" /><InterviewAge match={m} /></span></td>
                    <td className="max-w-[240px] px-3 py-2"><EditableText item={m} fieldKey="prximaAo" /></td>
                  </tr>
                ))}
                {!vaga._matches.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem matches.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'detalhes' && (det.loading ? <BlockSkeleton n={4} /> : (
          <div className={cn('grid gap-3 md:grid-cols-2')}>
            <TextBlock title="Requisitos eliminatórios" value={d.requisitosEliminatrios} />
            <TextBlock title="Principais atividades" value={d.principaisAtividadesVaga} />
            <TagBlock title="Competências essenciais" values={d.competnciasEssenciais} />
            <TagBlock title="Competências desejáveis" values={d.competnciasDesejveis} />
            <div className="md:col-span-2 rounded-md border border-border bg-card p-4">
              <Facts items={[
                { label: 'Eixo', value: canon(vaga.eixoDeAtuao) }, { label: 'Contratação', value: canon(vaga.modalidadeDeContratao) },
                { label: 'Modalidade de atuação', value: canon(d.modalidadeDeAtuaoVaga) }, { label: 'UF de atuação', value: clean(vaga.ufDeAtuao)?.join(', ') },
                { label: 'Cidade / Regional', value: clean(d.cidadeRegional) }, { label: 'Gerente (destino)', value: clean(d.gerenteDeProjetosDestino) },
                { label: 'Motivo da abertura', value: canon(d.motivoDaAbertura) }, { label: 'Origem do preenchimento', value: canon(d.origemDoPreenchimento) },
                { label: 'Abertura da vaga', value: fmtDate(d.dataDeAberturaDaVaga) }, { label: 'Previsão de preenchimento', value: fmtDate(vaga.previsoDePreenchimento) },
                { label: 'Salário previsto', value: typeof d.salrioPrevistoR === 'number' ? d.salrioPrevistoR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null },
                { label: 'Colaborador(a) alocado(a)', value: clean(vaga.colaboradoraAlocadoa) },
              ]} />
            </div>
          </div>
        ))}
        {tab === 'obs' && (det.loading ? <BlockSkeleton n={1} /> : <TextBlock title="Observações (vaga)" value={d.observaesVaga} />)}
        {det.error && <p className="text-sm text-destructive">{det.error}</p>}
      </section>
    </div>
  );
}
