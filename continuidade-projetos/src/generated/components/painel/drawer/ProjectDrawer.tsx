import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { LinkBotao } from '@generated/components/painel/LinkBotao';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@components/ui/sheet';
import { Chip, statusTone } from '@generated/components/painel/Chips';
import { ResumoSection } from '@generated/components/painel/drawer/ResumoProdutos';
import { ProdutosRestantes } from '@generated/components/painel/drawer/ProdutosRestantes';
import { DecisaoSection } from '@generated/components/painel/drawer/EditSections';
import { EquipeClt } from '@generated/components/painel/drawer/EquipeClt';
import { PerspectivaSection } from '@generated/components/painel/drawer/PerspectivaSection';
import { AlertaCustoSection } from '@generated/components/painel/drawer/AlertaCustoSection';
import {
  draftAFrom, draftDecisaoFrom, draftPerspFrom, perspNorm, rangeIncompleto, same,
  type DraftA, type DraftDecisao, type DraftPersp,
} from '@generated/components/painel/drawer/types';
import { salvarPerspectiva } from '@generated/server/negocio';
import { salvarPerspectivaQuadro } from '@generated/server/projetos';
import { perspAtual } from '@generated/lib/painel';
import { NIVEIS_PERSPECTIVA, TEMPERATURAS, TIPOS_PERSPECTIVA } from '@generated/lib/negocio';
import { decisaoChaveMudou, preencheDataDecisao, useSalvarProjeto } from '@generated/components/painel/drawer/useSalvarProjeto';
import {
  BOARD_A_ID, BOARD_B_ID, BOARD_EQUIPES_ID, MONDAY_ORIGIN, calcManterAte, dataBaseDe, itemUrl, todayIso, ultimoProdutoPrevisto,
  type Decisao, type Projeto, type Row,
} from '@generated/lib/painel';
import type { PainelData } from '@generated/hooks/usePainelData';
import { Section } from '@generated/components/painel/Fields';
import { HistoricoLista } from '@generated/components/painel/log/HistoricoCard';
import { StatusCatField } from '@generated/components/painel/drawer/StatusCatField';
import { useSalvarExtras } from '@generated/hooks/useSalvarExtras';
import type { Simulacao } from '@generated/lib/extras';

const ANCORAS = [
  { id: 'sec-resumo', label: 'Projeto' },
  { id: 'sec-produtos', label: 'Produtos restantes' },
  { id: 'sec-perspectiva', label: 'Perspectiva de renovação/aditivo' },
  { id: 'sec-equipe', label: 'Equipe' },
  { id: 'sec-custo', label: 'Simulação de custo' },
  { id: 'sec-decisao', label: 'Decisão' },
  { id: 'sec-historico', label: 'Histórico' },
];

/** Assinatura dos dados vindos do servidor (sem ids/updatedAt) para detectar mudanças externas. */
function assinatura(p: Projeto, dec: Decisao | undefined): string {
  return JSON.stringify([draftAFrom(p), draftDecisaoFrom(dec), dec?.atualizacaoEquipe ?? null, dec?.dataDecisao ?? null]);
}

const ehNivel = (v: string | null): v is (typeof NIVEIS_PERSPECTIVA)[number] => !!v && (NIVEIS_PERSPECTIVA as readonly string[]).includes(v);
const ehTipo = (v: string | null): v is (typeof TIPOS_PERSPECTIVA)[number] => !!v && (TIPOS_PERSPECTIVA as readonly string[]).includes(v);
const ehTemp = (v: string | null): v is (typeof TEMPERATURAS)[number] => !!v && (TEMPERATURAS as readonly string[]).includes(v);

export function ProjectDrawer({ row, onClose, data }: { row: Row | null; onClose: () => void; data: PainelData }) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 bg-background p-0 sm:max-w-2xl" showCloseButton>
        {row ? (
          <DrawerBody key={row.projeto.id} row={row} onClose={onClose} data={data} />
        ) : (
          <SheetTitle className="sr-only">Projeto</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ row, onClose, data }: { row: Row; onClose: () => void; data: PainelData }) {
  const p = row.projeto;
  // Valor salvo da decisão (row.decisao já inclui o rascunho em edição).
  const decisaoRow = data.getDecisao(p.id);
  const hist = data.perspectivas[p.id] ?? [];
  const ultimaPersp = hist[0];
  const baseP: DraftPersp = useMemo(() => draftPerspFrom(perspAtual(decisaoRow, ultimaPersp)), [decisaoRow, ultimaPersp]);
  const rasc = data.rascunhos[p.id];
  const { setRascunho } = data;
  const [baseA, setBaseA] = useState<DraftA>(() => draftAFrom(p));
  const [baseD, setBaseD] = useState<DraftDecisao>(() => draftDecisaoFrom(decisaoRow));
  const [a, setA] = useState<DraftA>(() => rasc?.a ?? draftAFrom(p));
  const [d, setD] = useState<DraftDecisao>(() => rasc?.d ?? draftDecisaoFrom(decisaoRow));
  const [pp, setPP] = useState<DraftPersp>(() => rasc?.p ?? baseP);
  const baseCat = decisaoRow?.statusCat ?? null;
  const baseBase = useMemo(() => [...(decisaoRow?.baseIds ?? [])].sort(), [decisaoRow]);
  const baseSim = useMemo(() => decisaoRow?.sim ?? {}, [decisaoRow]);
  const [cat, setCat] = useState<string | null>(() => (rasc?.cat !== undefined ? rasc.cat : baseCat));
  const [base, setBase] = useState<string[]>(() => rasc?.base ?? baseBase);
  const [sim, setSim] = useState<Simulacao>(() => rasc?.sim ?? baseSim);
  const [savingX, setSavingX] = useState(false);
  const salvarExtras = useSalvarExtras(data);
  const [savingP, setSavingP] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [desatualizado, setDesatualizado] = useState(false);
  const { salvar, saving: savingProj } = useSalvarProjeto(data);
  const saving = savingProj || savingP || savingX;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detecta mudanças vindas do servidor após "Atualizar dados" (nunca sobrescreve o formulário em silêncio).
  const aDirty = !same(a, baseA);
  const dDirty = !same(d, baseD);
  const pDirty = !same(perspNorm(pp), perspNorm(baseP));
  const catDirty = cat !== baseCat;
  const baseDirty = !same([...base].sort(), baseBase);
  const simDirty = !same(Object.entries(sim).sort(), Object.entries(baseSim).sort());
  const xDirty = catDirty || baseDirty || simDirty;
  const dirty = aDirty || dDirty || pDirty || xDirty;

  // Rascunho compartilhado: lista e cards mostram o valor na hora, com a marca "rascunho".
  useEffect(() => {
    setRascunho(p.id, dirty ? {
      a: aDirty ? a : undefined, d: dDirty ? d : undefined, p: pDirty ? pp : undefined,
      cat: catDirty ? cat : undefined, base: baseDirty ? base : undefined, sim: simDirty ? sim : undefined,
    } : null);
  }, [dirty, aDirty, dDirty, pDirty, catDirty, baseDirty, simDirty, a, d, pp, cat, base, sim, p.id, setRascunho]);

  const sig = assinatura(p, decisaoRow);
  const syncedSig = useRef(sig);
  const lastSavedAt = useRef(data.savedAt);
  useEffect(() => {
    if (data.savedAt !== lastSavedAt.current) {
      lastSavedAt.current = data.savedAt;
      if (sig !== syncedSig.current) setDesatualizado(true);
    } else if (!desatualizado) {
      syncedSig.current = sig; // alterações locais (salvamentos otimistas, reversões) são aceitas
      if (!dirty) {
        // Formulário sem edições pendentes acompanha os valores locais (ex.: após "Reverter").
        const nA = draftAFrom(p); const nD = draftDecisaoFrom(decisaoRow);
        setBaseA(nA); setBaseD(nD); setA(nA); setD(nD);
      }
    }
  }, [sig, data.savedAt, desatualizado, dirty, p, decisaoRow]);

  const recarregar = () => {
    const nA = draftAFrom(p); const nD = draftDecisaoFrom(decisaoRow);
    setBaseA(nA); setBaseD(nD); setA(nA); setD(nD); setPP(baseP);
    setCat(baseCat); setBase(baseBase); setSim(baseSim);
    setErrors({}); setDesatualizado(false);
    syncedSig.current = sig;
  };

  const termino = useMemo(
    () => ultimoProdutoPrevisto({ ...p, contratual: a.contratual }, row.produtos).date,
    [p, a.contratual, row.produtos],
  );
  // Data da decisão passa a ser hoje se Decisão, Meses ou Perspectiva mudarem, ou se estiver vazia
  // ao salvar com Decisão/Meses preenchidos. Caso contrário: Data da decisão → atualização do item → hoje.
  const dataBaseDecisao = decisaoChaveMudou(d, baseD) || (dDirty && preencheDataDecisao(d, decisaoRow))
    ? todayIso()
    : dataBaseDe(decisaoRow);
  const manterAte = calcManterAte(dataBaseDecisao, d.meses);
  const validar = () => {
    const errs: Record<string, string> = {};
    if (rangeIncompleto(a.contratual)) errs.contratual = 'Preencha início e fim do período contratual.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!validar()) {
      toast.error('Revise os campos destacados antes de salvar.');
      return;
    }
    if (pDirty) {
      setSavingP(true);
      try {
        const r = await salvarPerspectivaQuadro({
          data: { decisionId: decisaoRow?.id?.startsWith('tmp-') ? null : decisaoRow?.id ?? null, projectId: p.id, projectName: p.name, tipo: pp.tipo, nivel: pp.nivel, temperatura: pp.temperatura, report: pp.report },
        });
        if (!r?.ok) {
          toast.error(`Não foi possível salvar: perspectiva. ${r?.erro ?? 'Tente novamente.'}`);
        } else {
          if (r.decisao) data.upsertDecisao(r.decisao, decisaoRow?.id);
          // Histórico do app continua registrando cada salvamento.
          const doc = await salvarPerspectiva({
            data: { projectId: p.id, nivel: ehNivel(pp.nivel) ? pp.nivel : null, temperatura: ehTemp(pp.temperatura) ? pp.temperatura : null, tipo: ehTipo(pp.tipo) ? pp.tipo : null, report: pp.report },
          }).catch((e: unknown) => { console.error('histórico perspectiva', e); return null; });
          if (doc) data.addPerspectiva(doc);
          if (!aDirty && !dDirty && !xDirty) toast.success('Perspectiva salva em Decisões do Vibe.');
        }
      } catch (e) {
        console.error('salvarPerspectiva', e);
        toast.error('Não foi possível salvar a perspectiva. Tente novamente.');
      } finally {
        setSavingP(false);
      }
    }
    if (xDirty) {
      setSavingX(true);
      try {
        const r = await salvarExtras(row, { cat: catDirty ? cat : undefined, base: baseDirty ? base : undefined, sim: simDirty ? sim : undefined });
        if (!r.ok) toast.error(`Não foi possível salvar: ${r.falhas.join(' e ')}.${r.gravado.length ? ` Gravado: ${r.gravado.join(', ')}.` : ''} Tente novamente.`);
        else if (!aDirty && !dDirty) toast.success(`Salvo em Decisões do Vibe: ${r.gravado.join(', ')}.`);
      } finally {
        setSavingX(false);
      }
    }
    if (aDirty || dDirty) {
      const ok = await salvar({ row: { ...row, decisao: decisaoRow }, a, baseA, d, baseD, dDirty });
      if (ok) { setBaseA(a); setBaseD(d); }
    }
  };

  // Descartar restaura os valores anteriores (inclui a simulação).
  const onCancel = () => {
    setA(baseA); setD(baseD); setPP(baseP); setCat(baseCat); setBase(baseBase); setSim(baseSim); setErrors({});
    if (!dirty) onClose();
  };

  const irPara = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const meta = [p.sigla, p.codigo].filter(Boolean).join(' · ');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border bg-card px-5 pb-3 pt-5 pr-12 sm:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip tone={statusTone(p.status)} dot>{p.status ?? 'Sem status'}</Chip>
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        </div>
        <SheetTitle className="text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground">{p.name}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes, prazos, equipe e decisão de continuidade do projeto</SheetDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkBotao href={itemUrl(BOARD_A_ID, p.id)}>Projeto no Histórico de Projetos</LinkBotao>
          {p.quadroUrl && <LinkBotao href={p.quadroUrl}>Quadro do projeto</LinkBotao>}
          <LinkBotao href={`${MONDAY_ORIGIN}/boards/${BOARD_B_ID}`}>Produtos a entregar</LinkBotao>
          <LinkBotao href={`${MONDAY_ORIGIN}/boards/${BOARD_EQUIPES_ID}`}>Equipe (Equipes Revisadas)</LinkBotao>
        </div>
        <StatusCatField value={cat} onChange={setCat} opcoes={data.statusOpcoes} sujo={catDirty} />
        <nav aria-label="Seções do projeto" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
          {ANCORAS.map((s, i) => (
            <span key={s.id} className="flex shrink-0 items-center">
              {i > 0 && <span className="px-0.5 text-muted-foreground" aria-hidden>·</span>}
              <button type="button" onClick={() => irPara(s.id)} className="min-h-8 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {s.label}
              </button>
            </span>
          ))}
        </nav>
      </header>

      {desatualizado && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[hsl(var(--warning-soft))] px-5 py-2.5 text-sm text-[hsl(var(--warning-ink))] sm:px-6">
          <span>Este projeto foi atualizado. Recarregar dados?</span>
          <button type="button" onClick={recarregar} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-current/30 bg-card px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RefreshCw className="size-3.5" aria-hidden /> Recarregar dados
          </button>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [&>section:first-child]:border-t-0 [&>section]:scroll-mt-2">
        <ResumoSection row={row} />
        <ProdutosRestantes
          produtos={row.produtos} data={data} projectId={p.id} projectName={p.name}
          carregando={data.produtosPendentes > 0} erro={data.produtosErro} onRetry={data.retryProdutos}
        />
        <PerspectivaSection value={pp} onChange={setPP} hist={hist} sujo={pDirty} />
        <EquipeClt row={row} data={data} baseIds={base} setBaseIds={setBase} sujoBase={baseDirty} />
        <AlertaCustoSection
          row={row} meses={d.meses} setMeses={(v) => setD({ ...d, meses: v })} manterAte={manterAte}
          sim={sim} setSim={setSim} sujo={d.meses !== baseD.meses || simDirty}
        />
        <DecisaoSection
          d={d} setD={setD} termino={termino} dataBase={dataBaseDecisao} errors={errors}
          sujo={d.decisao !== baseD.decisao || d.detalhe !== baseD.detalhe || !same(d.responsaveis, baseD.responsaveis)}
        />
        <Section title="Histórico" id="sec-historico" aside={<span className="text-xs text-muted-foreground">Compartilhado no quadro Continuidade – Decisões</span>}>
          <HistoricoLista data={data} projectId={p.id} inicial={5} />
        </Section>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Salvando…' : dirty ? 'Alterações em rascunho — clique em Salvar para gravar' : 'Tudo salvo'}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="min-h-10 rounded-md border border-border bg-card px-4 text-sm text-foreground hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {dirty ? 'Descartar' : 'Fechar'}
          </button>
          <button type="button" onClick={onSave} disabled={!dirty || saving} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
          </button>
        </div>
      </footer>
    </div>
  );
}
