import { useState } from 'react';
import { ArrowUpRight, ExternalLink, IdCard } from 'lucide-react';
import MapeamentoSheet from '@generated/components/pages/MapeamentoSheet';
import { desalocInfo, tapSituOf, TAP } from '@generated/lib/esteira';
import { Pill, GlowDot } from '@generated/components/Pill';
import { PageHeader, Facts, TextBlock, TagBlock, BlockSkeleton } from '@generated/components/pages/PageBits';
import { useItemDetails, PERFIL_DETAIL_COLS } from '@generated/hooks/useItemDetails';
import { fmtDate } from '@generated/lib/data';
import { canon, clean } from '@generated/lib/normalize';
import { RoundAge, InterviewAge, AgeBadge, perfilAge } from '@generated/components/Age';
import { EditableStatus } from '@generated/components/edit/Editable';

function LinkOut({ label, link }) {
  const v = clean(link);
  if (!v?.url) return <span className="text-sm text-muted-foreground">{label}: —</span>;
  return <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/50">{label} <ExternalLink className="h-3.5 w-3.5" /></a>;
}

export default function PessoaPage({ perfil, crumbs, onBack, openVaga }) {
  const det = useItemDetails(perfil.id, PERFIL_DETAIL_COLS);
  const d = det.item ?? {};
  const info = desalocInfo(perfil);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <MapeamentoSheet perfil={perfil} open={mapOpen} onOpenChange={setMapOpen} />
      <PageHeader crumbs={crumbs} onBack={onBack} itemId={perfil.id} itemType="perfil" eyebrow="Ficha da pessoa" title={perfil.name}>
        <div className="flex flex-wrap items-center gap-2">{perfilAge(perfil) && <AgeBadge {...perfilAge(perfil)} />}<EditableStatus item={perfil} fieldKey="statusDoPerfil" /><Pill fieldKey="senioridadeAtual" label={perfil.senioridadeAtual} /><Pill fieldKey="vnculo" label={perfil.vnculo} />
          <button onClick={() => setMapOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/50 bg-accent/40 px-4 text-sm font-medium hover:border-primary"><IdCard className="h-4 w-4" />Mapeamento completo</button></div>
        <Facts items={[
          { label: 'Gerente de origem', value: clean(perfil.gerenteDeOrigem) },
          { label: 'Papel de origem', value: clean(perfil.papelDeOrigem) },
          { label: 'UF de residência', value: clean(perfil.ufDeResidncia)?.join(', ') },
          { label: 'Disponível em', value: perfil.dataDeDisponibilidade ? fmtDate(perfil.dataDeDisponibilidade) : null },
          { label: 'Situação', value: info?.situ ?? null, tone: info?.ocioso > 0 ? 'danger' : info?.days >= 0 ? 'warn' : null },
          { label: 'Fim do TAP', value: perfil._fimTap ? fmtDate(perfil._fimTap) : (perfil._noPlan ? 'Sem data no planejamento' : null) },
          { label: 'Situação no TAP', value: tapSituOf(perfil), tone: tapSituOf(perfil) === TAP.desaloc || tapSituOf(perfil) === TAP.ociosa ? 'danger' : null },
        ]} />
      </PageHeader>

      <section>
        <h2 className="mb-3 text-sm font-medium">Vagas em que está <span className="text-muted-foreground">· {perfil._matches.length}</span></h2>
        {perfil._matches.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">Esta pessoa ainda não aparece em nenhuma rodada de match.</p>
        ) : (
          <ol className="relative ml-1 border-l border-border pl-5">
            {perfil._matches.map((m) => (
              <li key={m.id} className="relative pb-4 last:pb-0">
                <GlowDot className="absolute -left-[23.5px] top-4 h-2 w-2" />
                <button onClick={() => openVaga(m._vagaId)} className="group flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-card p-3 text-left lift hover:shadow-[var(--glow-stack)]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" title={m._vagaName}>{m._vagaName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {canon(m.resultadoDaRodada) || 'Sem resultado'} · envio {fmtDate(m.dataDeEnvioDoCard)}
                    </span>
                  </span>
                  <RoundAge match={m} /><InterviewAge match={m} />
                  <Pill fieldKey="rodada" label={m.rodada} />
                  <Pill fieldKey="statusDoMatch" label={m.statusDoMatch} />
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Perfil</h2>
        <div className="flex flex-wrap gap-2"><LinkOut label="LinkedIn" link={perfil.linkedin} /><LinkOut label="Card de Perfil" link={perfil.linkCardDePerfilFc10} />{!det.loading && clean(d.currculoLattes)?.url && <LinkOut label="Lattes" link={d.currculoLattes} />}</div>
        {det.loading ? <BlockSkeleton n={4} /> : (
          <div className="grid gap-3 md:grid-cols-2">
            <TagBlock title="Perfil / Áreas de atuação" values={perfil.perfilReasDeAtuao} />
            <TagBlock title="Competências e habilidades" values={d.competnciasEHabilidades} />
            <TagBlock title="Principais interesses" values={d.principaisInteresses} />
            <TagBlock title="UFs de interesse" values={d.ufsDeInteresse} />
            <TextBlock title="Pontos fortes" value={d.pontosFortes} />
            <TextBlock title="Pontos de melhoria" value={d.pontosDeMelhoria} />
            <TextBlock title="Principais atividades / entregas" value={d.principaisAtividadesEntregas} />
            <TextBlock title="Observações" value={d.observaesPerfil} />
          </div>
        )}
        {det.error && <p className="text-sm text-destructive">{det.error}</p>}
      </section>
    </div>
  );
}
