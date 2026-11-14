import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getStructure, listBoards, listWorkspaces, previewImport, saveImport, saveNoIndicatorProject } from '@generated/server/importer';
import { INDICATOR_FIELDS, MEASUREMENT_FIELDS, PRODUCT_FIELDS, RISK_FIELDS, SCHEDULE_FIELDS, SUBITEM_FIELDS, suggestStatus, type ProjectConfig } from '@generated/lib/fields';
import { cn } from '@lib/utils';
import { ErrorBox } from '../States';
import { MappingTable } from './MappingStep';
import { PreviewStep } from './PreviewStep';
import { GroupsStep, groupsValid } from './GroupsStep';
import { OpsPreview } from './OpsPreview';
import { initialConfig, opsLabels, withOpsStatusSuggestions } from './wizard-config';
import { stagesOf } from '@generated/lib/stages';
import { runSubitemParts } from './subparts';
import { SearchSelect } from '../SearchSelect';

type Structure = Awaited<ReturnType<typeof getStructure>>;
export type Preview = Awaited<ReturnType<typeof previewImport>>;
const uniq = (a: string[]) => [...new Set(a)];
/** Junta as prévias parciais (uma por etapa) em uma única prévia. */
function mergePreview(acc: Preview | null, r: Preview, groups: string[]): Preview {
  const base: Preview = acc ?? { ...r, sched: null, subs: null, prods: null, risks: null };
  const ind = groups.includes('ind') || groups.includes('med')
    ? { indicatorCount: r.indicatorCount, measurementCount: r.measurementCount, hasIndicators: r.hasIndicators, unresolved: r.unresolved, sampleIndicators: r.sampleIndicators, sampleMeasurements: r.sampleMeasurements, statusMedicaoValues: r.statusMedicaoValues, statusMetaValues: r.statusMetaValues, unavailableFields: r.unavailableFields }
    : {};
  let sched = r.sched ?? base.sched;
  const subs = r.subs ?? base.subs;
  if (sched && r.subs) {
    sched = { ...sched, subCount: r.subs.count, sampleSubs: r.subs.sample, unresolved: [...sched.unresolved, ...r.subs.unresolved], unavailable: uniq([...sched.unavailable, ...r.subs.unavailable]), statusValues: uniq([...sched.statusValues, ...r.subs.statusValues]) };
  }
  return { ...base, ...ind, sched, subs, prods: r.prods ?? base.prods, risks: r.risks ?? base.risks };
}
const STEPS = ['Área de trabalho', 'Quadro', 'Grupos', 'Colunas', 'Prévia', 'Confirmar'];
const btn = 'flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50';

export function ImportWizard({ initialBoardId, onDone, onCancel }: { initialBoardId?: string; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(initialBoardId ? 2 : 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [ws, setWs] = useState('');
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [boardId, setBoardId] = useState(initialBoardId ?? '');
  const [st, setSt] = useState<Structure | null>(null);
  const [cfg, setCfgRaw] = useState<ProjectConfig | null>(null);
  const [remember, setRemember] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [noInd, setNoInd] = useState(false);

  const setCfg = (c: ProjectConfig) => {
    setCfgRaw(c);
    setRemember((r) => ({ ...r, ...Object.fromEntries((['indicatorGroupId', 'measurementGroupId', 'scheduleGroupId', 'productGroupId', 'riskGroupId'] as const).filter((k) => c[k]).map((k) => [k, c[k] ?? ''])) }));
  };

  const run = async <T,>(fn: () => Promise<T>, msg: string): Promise<T | null> => {
    setBusy(true); setErr(null);
    try { return await fn(); } catch (e) { console.error(e); setErr(`${msg} ${e instanceof Error ? e.message : ''}`); return null; } finally { setBusy(false); }
  };

  useEffect(() => { if (!initialBoardId) void run(() => listWorkspaces({ data: {} }), 'Não foi possível listar as áreas de trabalho.').then((r) => r && setWorkspaces(r)); }, [initialBoardId]);
  useEffect(() => { if (initialBoardId) void loadStructure(initialBoardId); }, [initialBoardId]);

  const pickWs = async (id: string) => {
    setWs(id); setBoards([]); setBoardId('');
    if (!id) return;
    const r = await run(() => listBoards({ data: { workspaceId: id } }), 'Não foi possível listar os quadros.');
    if (r) { setBoards(r); setStep(1); }
  };

  async function loadStructure(id: string) {
    const s = await run(() => getStructure({ data: { boardId: id } }), 'Não foi possível ler a estrutura do quadro.');
    if (!s) return;
    setSt(s);
    setNoInd(s.noIndicators);
    setCfg(initialConfig(s.savedConfig, s.groups, s.columns, s.subitemColumns, !!s.subitemBoardId));
    setStep(2);
  }

  const subCols = st?.subitemColumns ?? [];
  const doPreview = async () => {
    if (!cfg || !st) return;
    const c = { ...cfg, importSubitems: !!cfg.importSubitems && !!st.subitemBoardId };
    const stages = stagesOf(c);
    if (stages.length === 0) return setErr('Selecione ao menos um grupo para importar.');
    // Prévia em etapas: uma leitura curta por grupo, juntadas no fim.
    let p: Preview | null = null;
    for (const s of stages) {
      const r = await run(() => previewImport({ data: { boardId, config: c, groups: s.groups, subMode: s.subMode } }), `Falha ao gerar a prévia (${s.label}).`);
      if (!r) return;
      p = mergePreview(p, r, s.groups);
    }
    if (!p) return;
    setPreview(p);
    let next = withOpsStatusSuggestions(c, opsLabels(c, st.columns, subCols, p));
    const medCol = st.columns.find((x) => x.id === c.measurementCols.statusMedicao);
    const medLabels = [...new Set([...(medCol?.labels ?? []), ...p.statusMedicaoValues])];
    if (p.hasIndicators && !c.status.concluded.length && !c.status.reached.length) next = { ...next, status: suggestStatus(medLabels, p.statusMetaValues) };
    setCfg(next);
    setStep(4);
  };

  const doSaveNoInd = async () => {
    const r = await run(() => saveNoIndicatorProject({ data: { boardId } }), 'Falha ao salvar o projeto.');
    if (!r) return;
    if (r.ok) { toast.success('Projeto cadastrado sem indicador elaborado', { description: r.history ?? undefined }); onDone(); }
    else setErr(r.summary);
  };

  const doSave = async () => {
    if (!cfg) return;
    // Uma requisição por grupo: cada etapa é curta e uma falha preserva os dados anteriores daquele grupo.
    const stages = stagesOf(cfg);
    if (stages.length === 0) return setErr('Selecione ao menos um grupo para importar.');
    const out: string[] = [];
    let failed = false;
    let history: string | null = null;
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i]!;
      if (s.subMode === 'only') {
        // Subelementos em partes: cada requisição trata uma fatia de atividades.
        const sr = await run(() => runSubitemParts(boardId, cfg), `Falha ao salvar ${s.label}.`);
        if (!sr) { failed = true; break; }
        out.push(`${s.label}: ${sr.summary}`);
        if (!sr.ok) { failed = true; setErr(sr.summary); break; }
        continue;
      }
      const r = await run(() => saveImport({ data: { boardId, config: cfg, groups: s.groups, subMode: s.subMode, link: i === 0 } }), `Falha ao salvar ${s.label}.`);
      if (!r) { failed = true; break; }
      if (i === 0) history = r.history ?? null;
      out.push(`${s.label}: ${r.summary}`);
      if (!r.ok) { failed = true; setErr(r.summary); break; }
    }
    if (!failed) { toast.success('Importação concluída', { description: [...out, history].filter(Boolean).join(' · ') }); onDone(); }
    else if (out.length) toast.warning('Importação parcial', { description: out.join(' · ') });
  };

  const medLabels = [...new Set([...(st?.columns.find((c) => c.id === cfg?.measurementCols.statusMedicao)?.labels ?? []), ...(preview?.statusMedicaoValues ?? [])])];
  const counts = preview ? [
    preview.hasIndicators && `${preview.indicatorCount} indicadores e ${preview.measurementCount} medições`,
    preview.sched && `${preview.sched.count} atividades e as subatividades de todas elas (lidas em partes)`,
    preview.prods && `${preview.prods.count} produtos`,
    preview.risks && `${preview.risks.count} riscos`,
  ].filter(Boolean).join(', ') : '';

  return (
    <div className="rounded-lg border border-primary/30 bg-card">
      <ol className="flex gap-1 overflow-x-auto border-b border-border p-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cn('flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-xs', i === step ? 'bg-primary text-primary-foreground' : i < step ? 'text-foreground' : 'text-muted-foreground')}>
            <span className="flex size-5 items-center justify-center rounded-full border border-current font-mono text-[10px]">{i < step ? <Check className="size-3" aria-hidden /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <div className="space-y-4 p-4">
        {err && <ErrorBox message={err} />}
        {step <= 1 && !initialBoardId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><span className="text-xs text-muted-foreground">1. Área de trabalho</span>
              <SearchSelect ariaLabel="Área de trabalho" value={ws} disabled={busy || !workspaces.length} placeholder={workspaces.length ? 'Selecione ou pesquise…' : 'Carregando…'}
                options={workspaces.map((w) => ({ value: w.id, label: w.name }))} onChange={(v) => void pickWs(v)} /></div>
            <div className="space-y-1"><span className="text-xs text-muted-foreground">2. Quadro do projeto</span>
              <SearchSelect ariaLabel="Quadro do projeto" value={boardId} disabled={!boards.length || busy}
                placeholder={ws && !boards.length && !busy ? 'Nenhum quadro nesta área' : 'Selecione ou pesquise…'}
                options={boards.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => { setBoardId(v); if (v) void loadStructure(v); }} /></div>
          </div>
        )}
        {st && cfg && step >= 2 && step <= 3 && (
          <>
            <p className="text-sm"><span className="text-muted-foreground">Quadro:</span> <b>{st.name}</b> <span className="text-muted-foreground">· {st.workspaceName} · ID {st.id}</span></p>
            <label className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <input type="checkbox" checked={noInd} onChange={(e) => { setNoInd(e.target.checked); setStep(2); }} className="mt-0.5 size-4" />
              <span>
                <b>Projeto sem indicador elaborado</b>
                <span className="block text-xs text-muted-foreground">Cadastra o projeto sem ler grupos e colunas. Ele conta em "projetos inseridos" no painel. Quando os indicadores existirem, abra "Ajustar mapeamento", desmarque esta opção e importe.</span>
              </span>
            </label>
            {!noInd && step === 2 && <>
              <p className="text-sm font-semibold">3. Grupos a importar</p>
              <GroupsStep cfg={cfg} setCfg={setCfg} groups={st.groups} remember={remember} hasSubitems={!!st.subitemBoardId} />
              <p className="text-xs text-muted-foreground">Use os grupos reais do quadro — agrupamentos de visualização não são grupos. Cada grupo é opcional.</p>
            </>}
            {!noInd && step === 3 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {cfg.indicatorGroupId && <MappingTable title="Colunas do indicador" defs={INDICATOR_FIELDS} cols={st.columns} value={cfg.indicatorCols} onChange={(v) => setCfg({ ...cfg, indicatorCols: v })} />}
                {cfg.measurementGroupId && <MappingTable title="Colunas da medição" defs={MEASUREMENT_FIELDS} cols={st.columns} value={cfg.measurementCols} onChange={(v) => setCfg({ ...cfg, measurementCols: v })} />}
                {cfg.scheduleGroupId && <MappingTable title="Colunas do cronograma (atividade = nome do item)" defs={SCHEDULE_FIELDS} cols={st.columns} value={cfg.scheduleCols ?? {}} onChange={(v) => setCfg({ ...cfg, scheduleCols: v })} />}
                {cfg.scheduleGroupId && cfg.importSubitems && st.subitemBoardId && <MappingTable title="Colunas dos subelementos (quadro de subitens)" defs={SUBITEM_FIELDS} cols={subCols} value={cfg.subitemCols ?? {}} onChange={(v) => setCfg({ ...cfg, subitemCols: v })} />}
                {cfg.productGroupId && <MappingTable title="Colunas dos produtos (produto = nome do item)" defs={PRODUCT_FIELDS} cols={st.columns} value={cfg.productCols ?? {}} onChange={(v) => setCfg({ ...cfg, productCols: v })} />}
                {cfg.riskGroupId && <MappingTable title="Colunas dos riscos (risco = nome do item)" defs={RISK_FIELDS} cols={st.columns} value={cfg.riskCols ?? {}} onChange={(v) => setCfg({ ...cfg, riskCols: v })} />}
              </div>
            )}
          </>
        )}
        {step === 4 && preview && cfg && st && (
          <div className="space-y-5">
            {preview.hasIndicators && <PreviewStep preview={preview} cfg={cfg} setCfg={setCfg} medLabels={medLabels} confirm={false} />}
            <OpsPreview p={preview} cfg={cfg} setCfg={setCfg} labels={opsLabels(cfg, st.columns, subCols, preview)} />
          </div>
        )}
        {step === 5 && preview && (
          <div className="rounded-md bg-muted p-4 text-sm">
            Serão salvos <b>{counts || 'nenhum registro'}</b> de <b>{preview.projectName}</b>. Registros existentes serão atualizados pelos IDs, sem duplicar; itens que sumiram do quadro serão inativados. Grupos desmarcados ficam como "não configurado". Nenhum dado será escrito no quadro de origem.
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <button onClick={onCancel} className="min-h-10 rounded-md px-4 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
          {step >= 3 && <button onClick={() => setStep(step - 1)} disabled={busy} className="min-h-10 rounded-md border border-border px-4 text-sm">Voltar</button>}
          {noInd && step === 2 && <button disabled={busy} onClick={() => void doSaveNoInd()} className={btn}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Salvar sem indicador</button>}
          {!noInd && step === 2 && <button disabled={!cfg || !groupsValid(cfg)} onClick={() => setStep(3)} className={btn}>Mapear colunas</button>}
          {(step === 3 || step === 4) && <button disabled={busy} onClick={() => void doPreview()} className={btn}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{step === 3 ? 'Gerar prévia' : 'Atualizar prévia'}</button>}
          {step === 4 && <button disabled={busy} onClick={() => setStep(5)} className={btn}>Continuar</button>}
          {step === 5 && <button disabled={busy} onClick={() => void doSave()} className={btn}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Confirmar e salvar</button>}
          {busy && step < 3 && <Loader2 className="size-5 animate-spin self-center text-muted-foreground" aria-label="Carregando" />}
        </div>
      </div>
    </div>
  );
}
