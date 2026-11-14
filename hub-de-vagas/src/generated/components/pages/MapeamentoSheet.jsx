import { ExternalLink, Mail, Phone } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@components/ui/sheet';
import { Pill, Tag } from '@generated/components/Pill';
import { AgeBadge, perfilAge } from '@generated/components/Age';
import { BlockSkeleton } from '@generated/components/pages/PageBits';
import { useItemDetails } from '@generated/hooks/useItemDetails';
import { fmtDate } from '@generated/lib/data';
import { canon, clean } from '@generated/lib/normalize';

// Every mapping column of the profile, loaded from the board only when the panel opens.
export const MAPEAMENTO_COLS = [
  'competnciasEHabilidades', 'pontosFortes', 'pontosDeMelhoria', 'perfilReasDeAtuao', 'principaisInteresses', 'principaisAtividadesEntregas',
  'observaesPerfil', 'ufsDeInteresse', 'interesseEmMudarDeCidade', 'mudanaDeResidncia', 'cidadeDeResidncia', 'ufDeResidncia', 'senioridadeAtual',
  'trilha', 'vnculo', 'modalidadeDeAtuaoAtual', 'tempoDeDgpeMeses', 'papelDeOrigem', 'gerenteDeOrigem', 'projeto', 'gatilhoDaRealocao',
  'dataDoGatilho', 'dataDeDisponibilidade', 'colaboradoraDestaque', 'tipoDeRealocao', 'email', 'telefone', 'linkedin', 'currculoLattes',
  'linkCardDePerfilFc10', 'fonteCensoDgpe', 'rodadaAtual', 'rodadasRestantes', 'statusDoPerfil',
];

const has = (v) => { const c = clean(v); return c != null && !(Array.isArray(c) && !c.length); };
function Row({ label, children, value }) {
  const content = children ?? (has(value) ? String(canon(clean(value))) : null);
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{content ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
const Tags = ({ values }) => (has(values) ? <span className="flex flex-wrap gap-1">{clean(values).map((x) => <Tag key={x}>{canon(x)}</Tag>)}</span> : null);
const Text = ({ value }) => (has(value) ? <p className="whitespace-pre-wrap leading-relaxed">{clean(value)}</p> : null);
const LinkV = ({ v, label }) => { const c = clean(v); return c?.url ? <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{label} <ExternalLink className="h-3 w-3" /></a> : null; };
function Group({ title, children }) {
  return <section className="border-t border-border pt-3"><h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">{title}</h3><dl>{children}</dl></section>;
}

export default function MapeamentoSheet({ perfil, open, onOpenChange }) {
  const det = useItemDetails(open ? perfil?.id : null, MAPEAMENTO_COLS);
  const d = { ...perfil, ...(det.item ?? {}) };
  const age = perfilAge(d);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-2 pb-2">
          <SheetDescription className="text-xs text-primary">Mapeamento do(a) colaborador(a)</SheetDescription>
          <SheetTitle className="text-xl font-medium tracking-tight">{perfil?.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2"><Pill fieldKey="statusDoPerfil" label={d.statusDoPerfil} />{age && <AgeBadge {...age} />}</div>
        </SheetHeader>
        {det.loading ? <div className="px-4"><BlockSkeleton n={6} /></div> : (
          <div className="flex flex-col gap-4 px-4 pb-6">
            {det.error && <p className="text-sm text-destructive">{det.error}</p>}
            <Group title="Origem">
              <Row label="Papel de origem" value={d.papelDeOrigem} /><Row label="Gerente de origem" value={d.gerenteDeOrigem} />
              <Row label="Projeto" value={d.projeto} /><Row label="Senioridade atual"><Pill fieldKey="senioridadeAtual" label={d.senioridadeAtual} /></Row>
              <Row label="Trilha" value={d.trilha} /><Row label="Vínculo" value={d.vnculo} /><Row label="Modalidade atual" value={d.modalidadeDeAtuaoAtual} />
              <Row label="Tempo de DGPE (meses)" value={d.tempoDeDgpeMeses} /><Row label="Destaque?" value={d.colaboradoraDestaque} />
            </Group>
            <Group title="Gatilho e disponibilidade">
              <Row label="Gatilho" value={d.gatilhoDaRealocao} /><Row label="Data do gatilho">{has(d.dataDoGatilho) ? fmtDate(d.dataDoGatilho) : null}</Row>
              <Row label="Disponível em">{has(d.dataDeDisponibilidade) ? fmtDate(d.dataDeDisponibilidade) : null}</Row>
              <Row label="Tipo de realocação" value={d.tipoDeRealocao} /><Row label="Rodada atual" value={d.rodadaAtual} /><Row label="Rodadas restantes" value={d.rodadasRestantes} />
            </Group>
            <Group title="Localização e mobilidade">
              <Row label="Cidade" value={d.cidadeDeResidncia} /><Row label="UF de residência"><Tags values={d.ufDeResidncia} /></Row>
              <Row label="Muda de cidade?" value={d.interesseEmMudarDeCidade} /><Row label="Mudança de residência?" value={d.mudanaDeResidncia} />
              <Row label="UFs de interesse"><Tags values={d.ufsDeInteresse} /></Row>
            </Group>
            <Group title="Perfil e competências">
              <Row label="Áreas de atuação"><Tags values={d.perfilReasDeAtuao} /></Row>
              <Row label="Competências e habilidades"><Tags values={d.competnciasEHabilidades} /></Row>
              <Row label="Principais interesses"><Tags values={d.principaisInteresses} /></Row>
            </Group>
            <Group title="Avaliação">
              <Row label="Pontos fortes"><Text value={d.pontosFortes} /></Row>
              <Row label="Pontos de melhoria"><Text value={d.pontosDeMelhoria} /></Row>
              <Row label="Atividades / entregas"><Text value={d.principaisAtividadesEntregas} /></Row>
              <Row label="Observações"><Text value={d.observaesPerfil} /></Row>
            </Group>
            <Group title="Contato e links">
              <Row label="E-mail">{d.email?.email ? <a href={`mailto:${d.email.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{d.email.email}</a> : null}</Row>
              <Row label="Telefone">{d.telefone?.phone ? <a href={`tel:${d.telefone.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{d.telefone.phone}</a> : null}</Row>
              <Row label="LinkedIn"><LinkV v={d.linkedin} label="Abrir" /></Row><Row label="Lattes"><LinkV v={d.currculoLattes} label="Abrir" /></Row>
              <Row label="Card de perfil (FC.10)"><LinkV v={d.linkCardDePerfilFc10} label="Abrir" /></Row><Row label="Fonte Censo DGPE" value={d.fonteCensoDgpe} />
            </Group>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
