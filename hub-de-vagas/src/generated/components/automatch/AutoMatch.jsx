import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, Send, Loader2, AlertTriangle, CheckCircle2, RotateCw, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { Skeleton } from '@components/ui/skeleton';
import { fetchGroup, MONTHS } from '@generated/lib/data';
import { GROUP_IDS, MATCH_VAGA_COLS, MATCH_PERFIL_COLS } from '@generated/lib/config';
import { fetchSchema } from '@generated/lib/boardMeta';
import { runMatch, eligibleVaga, monthKeyOf } from '@generated/lib/autoMatch';
import { applyMatches, isApplying } from '@generated/lib/autoMatchApply';
import { useEdit } from '@generated/components/edit/EditProvider';
import Suggestions from '@generated/components/automatch/Suggestions';
import PerfilView from '@generated/components/automatch/PerfilView';
import PdfPicker from '@generated/components/automatch/PdfPicker';
import MatrixView from '@generated/components/automatch/MatrixView';
import CompatTable from '@generated/components/automatch/CompatTable';
import Diagnostico from '@generated/components/automatch/Diagnostico';
import { RELOAD_EVENT } from '@generated/lib/familiaWrite';
import FilterBar, { FilterChips } from '@generated/components/automatch/FilterBar';
import { DEFAULT_FILTERS, loadPrefs, savePrefs, optionsFor, pruneFilters, applyFilters, pickedFrom, buildIndex, scoreActive, scoreLabel, otherFilters } from '@generated/lib/autoMatchFilters';
import { cn } from '@lib/utils';

const now = new Date();
const CURRENT = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const label = (k) => { const [y, m] = k.split('-'); return `${MONTHS[Number(m) - 1]}/${y}`; };

function EmptyFilters({ f, others, scoreGuilty, onClear, onScore }) {
  const sc = scoreActive(f) ? `com ${scoreLabel(f).replace('Score', 'score')}` : 'que atenda aos filtros';
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-12 text-center">
      <p className="text-sm font-medium">Nenhum perfil {sc} nas vagas filtradas</p>
      {others.length > 0 && <p className="max-w-xl text-xs text-muted-foreground">Outros filtros ativos: {others.join(' · ')}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={onClear} className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm hover:border-primary/50">Limpar filtros</button>
        {scoreGuilty && <button onClick={onScore} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Ajustar score</button>}
      </div>
    </div>
  );
}

const CARDS = { vagas: 'Vagas do mês', perfis: 'Perfis elegíveis', marcadas: 'Sugestões marcadas', sem: 'Vagas sem candidato' };
function Stat({ label: l, value, tone, active, onClick, sub }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cn('rounded-md border bg-card px-4 py-3 text-left transition-colors', active ? 'border-primary shadow-[var(--glow-stack)] ring-1 ring-primary/40' : 'border-border hover:border-primary/40')}>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className={`mt-1 text-2xl font-medium tabular-nums tracking-tight ${tone === 'danger' ? 'text-destructive' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </button>
  );
}

export default function AutoMatch({ reload, openVaga, openPerfil, updatedAt }) {
  const { canFor, checking } = useEdit();
  const [src, setSrc] = useState({ loading: true, error: null, vagas: [], perfis: [] });
  const [month, setMonth] = useState(CURRENT);
  const [run, setRun] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [schema, setSchema] = useState(null);
  const busyRef = useRef(false);
  useEffect(() => { let on = true; fetchSchema().then((r) => on && setSchema(r)); return () => { on = false; }; }, []);
  const prefs = useMemo(() => loadPrefs(), []);
  const [view, setView] = useState(prefs?.view ?? 'vaga');
  const [card, setCardRaw] = useState(prefs?.card ?? null);
  const [filters, setFilters] = useState(prefs?.filters ?? DEFAULT_FILTERS);
  useEffect(() => { savePrefs({ view, card, filters }); }, [view, card, filters]);
  const setCard = (c) => {
    const next = c === card ? null : c;
    if (next === 'perfis') setView('perfil'); else if (card === 'perfis') setView('vaga');
    setCardRaw(next);
  };
  const options = useMemo(() => (run ? optionsFor(run.results) : null), [run]);
  useEffect(() => { if (options) setFilters((f) => pruneFilters(f, options)); }, [options]);

  const load = useCallback(async () => {
    setSrc((s) => ({ ...s, loading: true, error: null }));
    try {
      const [vagas, perfis] = await Promise.all([fetchGroup(GROUP_IDS.vagas, MATCH_VAGA_COLS, true), fetchGroup(GROUP_IDS.perfis, MATCH_PERFIL_COLS, false)]);
      setSrc({ loading: false, error: null, vagas, perfis });
    } catch (e) {
      console.error('[automatch] erro ao carregar', e);
      setSrc((s) => ({ ...s, loading: false, error: 'Não foi possível carregar vagas e perfis.' }));
    }
  }, []);
  // Reload on (re)open and whenever the hub is refreshed.
  useEffect(() => { load(); }, [load, updatedAt]);
  // Reload after "Confirmar família" writes.
  useEffect(() => {
    const h = (e) => {
      const patches = new Map((e?.detail?.patches ?? []).map((x) => [String(x.id), x.labels]));
      if (patches.size) {
        const patch = (l) => l.map((it) => (patches.has(String(it.id)) ? { ...it, famliaDeRea: patches.get(String(it.id)) } : it));
        setSrc((st) => ({ ...st, vagas: patch(st.vagas), perfis: patch(st.perfis) }));
      }
      load();
    };
    window.addEventListener(RELOAD_EVENT, h); return () => window.removeEventListener(RELOAD_EVENT, h);
  }, [load]);

  // Months are rebuilt from the board on every load (no fixed list).
  const months = useMemo(() => [...new Set([CURRENT, ...src.vagas.filter(eligibleVaga).map((v) => monthKeyOf(v.dataDeIncioPrevista)).filter(Boolean)])].sort(), [src.vagas]);
  useEffect(() => {
    if (src.loading) return;
    if (!months.includes(month)) { setMonth(CURRENT); setRun(null); return; }
    // Fresh data → recompute an existing run for the same month, keeping ticks.
    setRun((prev) => (prev ? { ...runMatch(src.vagas, src.perfis, prev.month), month: prev.month } : prev));
  }, [src.vagas, src.perfis, src.loading, months]); // eslint-disable-line react-hooks/exhaustive-deps

  const doMatch = () => {
    const r = runMatch(src.vagas, src.perfis, month);
    setRun({ ...r, month });
    setChecked(new Set(r.results.flatMap((x) => x.sugestoes.map((s) => `${x.vaga.id}:${s.perfil.id}`))));
    setSummary(null);
  };
  const toggle = useCallback((k) => { if (busyRef.current) return; setChecked((c) => { const s = new Set(c); if (s.has(k)) s.delete(k); else s.add(k); return s; }); }, []);

  const picks = useMemo(() => pickedFrom(run, checked), [run, checked]);
  const canWrite = canFor('match') && canFor('vaga');
  // Index is built once per run; view filters only read from it (never re-run match/score).
  const index = useMemo(() => (run ? buildIndex(run) : null), [run]);
  const deferred = useDeferredValue(filters);
  const effCard = card === 'vagas' || card === 'perfis' ? null : card;
  // Ticking only forces a refilter when the visible set actually depends on it.
  const needsChecked = deferred.situacao !== 'todas' || effCard === 'marcadas';
  const manualSig = useMemo(() => (index ? [...checked].filter((k) => index.elimKeys.has(k)).sort().join('|') : ''), [checked, index]);
  const checkedDep = needsChecked ? checked : manualSig;
  const shown = useMemo(() => (index ? applyFilters(index, deferred, effCard, view, checked) : null), [index, deferred, effCard, view, checkedDep]); // eslint-disable-line react-hooks/exhaustive-deps
  const resetScore = () => setFilters((f) => ({ ...f, minScore: 0, scoreDir: 'gte' }));
  const clearAll = () => { setFilters(DEFAULT_FILTERS); setCardRaw((c) => (c === 'perfis' ? c : null)); };
  const changeView = useCallback((v) => { setView(v); setCardRaw((c) => ((c === 'perfis' && v !== 'perfil') || (c === 'marcadas' && v === 'todos') ? null : c)); }, []);
  const hidden = shown ? picks.filter((x) => !shown.visibleKeys.has(`${x.vaga.id}:${x.perfil.id}`)).length : 0;
  const markVisible = (on) => !progress && setChecked((c) => { const s = new Set(c); shown.visibleKeys.forEach((k) => (on ? s.add(k) : s.delete(k))); return s; });

  const apply = async () => {
    setConfirm(false);
    if (busyRef.current || isApplying()) return; // ignore repeated clicks
    busyRef.current = true;
    setProgress({ done: 0, total: picks.length });
    let res;
    try { res = await applyMatches(picks, run.month, (done, total) => setProgress({ done, total })); } finally { busyRef.current = false; setProgress(null); }
    if (res.busy) return;
    setSummary(res);
    setRun(null);
    setChecked(new Set());
    if (res.errors.length) toast.error(`${res.created} subitem(ns) criado(s), ${res.errors.length} erro(s)`);
    else toast.success(`${res.created} subitem(ns) criado(s) e status atualizados`);
    reload?.();
    if (!reload) load(); // hub refresh triggers our reload via updatedAt
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="lattice rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-primary"><Wand2 className="h-3.5 w-3.5" /> Match automático</div>
        <h2 className="mt-1 text-xl font-medium tracking-tight">Sugerir perfis para as vagas do mês</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Depois dos filtros eliminatórios (disponibilidade, vínculo, senioridade igual ou acima, geografia, já indicado), cada par passa por três camadas. <strong className="font-medium text-foreground">Área</strong> é uma trava: a coluna “Família de área” manda; sem ela, a família é inferida e só descarta quando os dois lados têm sinal forte (senão fica como parcial). <strong className="font-medium text-foreground">Viabilidade</strong> classifica senioridade e salário em ok / atenção / risco (qualquer risco = Baixo; sem dado não penaliza). <strong className="font-medium text-foreground">Aderência</strong> cruza competências, atividades, áreas, pontos fortes e de melhoria e interesses, e define a ordem. Perfis com menos de 4 de 6 dimensões preenchidas, gap crítico ou área parcial nunca ficam em “Indicar”. Desempate final: tempo desalocado. Nada é gravado até você clicar em “Aplicar e enviar”.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={(m) => { setMonth(m); if (run) { const r2 = runMatch(src.vagas, src.perfis, m); setRun({ ...r2, month: m }); setChecked(new Set(r2.results.flatMap((x) => x.sugestoes.map((s) => `${x.vaga.id}:${s.perfil.id}`)))); } }} disabled={src.loading || !!progress}>
            <SelectTrigger className="h-10 w-48 rounded-full" aria-label="Mês de início das vagas"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{label(m)}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={doMatch} disabled={src.loading || !!progress} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--glow-stack)] disabled:opacity-50">
            {src.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Fazer match
          </button>
          <button onClick={() => setConfirm(true)} disabled={!run || !picks.length || !!progress || !canWrite}
            title={!canWrite ? (checking ? 'Verificando permissões…' : 'Sem permissão de edição') : !run ? 'Rode “Fazer match” primeiro' : undefined}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/50 px-5 text-sm font-medium hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {progress ? `Enviando ${progress.done}/${progress.total}…` : `Aplicar e enviar${run ? ` (${picks.length})` : ''}`}
          </button>
          <PdfPicker perfis={src.perfis} loading={src.loading} />
          <CompatTable />
          <Diagnostico vagas={src.vagas} perfis={src.perfis} loading={src.loading} />
          <button onClick={load} disabled={src.loading || !!progress} aria-label="Recarregar dados" title="Recarregar dados" className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:border-primary/50 disabled:opacity-50"><RotateCw className="h-4 w-4" /></button>
        </div>
      </section>

      {schema?.missing?.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.1)] px-4 py-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" /><span><span className="font-medium">Colunas obrigatórias ausentes no quadro:</span> {schema.missing.map((m) => `${m.title} (${m.id}, ${m.board})`).join('; ')}. O match pode ficar incompleto.</span></p>
      )}
      {src.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{src.error}</p>}

      {summary && (
        <section className="rounded-md border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium">{summary.errors.length ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
            {summary.created} subitem(ns) criado(s) · {summary.statusOk} status atualizado(s) · {summary.skipped?.length ?? 0} pulado(s) · {summary.errors.length} erro(s)</p>
          {summary.skipped?.length > 0 && <ul className="mt-2 flex flex-col gap-1 text-xs">{summary.skipped.map((e) => <li key={`${e.what}|${e.why}`}><span className="font-medium">{e.what}:</span> <span className="text-muted-foreground">{e.why}</span></li>)}</ul>}
          {summary.errors.length > 0 && <ul className="mt-2 flex flex-col gap-1 text-xs">{summary.errors.map((e) => <li key={`${e.what}|${e.msg}`}><span className="font-medium">{e.what}:</span> <span className="text-muted-foreground">{e.msg}</span></li>)}</ul>}
        </section>
      )}

      {src.loading && !run ? <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div> : run ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Vagas de ${label(run.month)}`} value={run.vagasMes} active={card === 'vagas'} onClick={() => setCard('vagas')} />
            <Stat label="Perfis elegíveis" value={run.perfisElegiveis} active={card === 'perfis'} onClick={() => setCard('perfis')} />
            <Stat label="Sugestões marcadas" value={picks.length} sub={hidden ? `${hidden} oculta(s) pelos filtros` : null} active={card === 'marcadas'} onClick={() => setCard('marcadas')} />
            <Stat label="Vagas sem candidato" value={run.semCandidatos.length} tone={run.semCandidatos.length ? 'danger' : null} active={card === 'sem'} onClick={() => setCard('sem')} />
          </div>
          <FilterBar filters={filters} setFilters={setFilters} options={options} view={view} setView={changeView} />
          <FilterChips filters={filters} setFilters={setFilters} card={card} setCard={setCard} cardLabel={CARDS[card]} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {view === 'perfil' ? `Exibindo ${shown.perfilRows.length} de ${run.perfisElegiveis} perfis` : `Exibindo ${(view === 'todos' ? shown.todosRows : shown.vagaRows).length} de ${run.vagasMes} vagas`} · {shown.visibleKeys.size} sugestão(ões) visível(is)
            </p>
            <div className="flex gap-2">
              <button onClick={() => markVisible(true)} disabled={!shown.visibleKeys.size} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:border-primary/50 disabled:opacity-50"><CheckSquare className="h-3.5 w-3.5" />Marcar visíveis</button>
              <button onClick={() => markVisible(false)} disabled={!shown.visibleKeys.size} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:border-primary/50 disabled:opacity-50"><Square className="h-3.5 w-3.5" />Desmarcar visíveis</button>
            </div>
          </div>
          {shown.scoreHidden > 0 && (
            <p className="rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-xs">
              <span className="font-medium">{shown.scoreHidden} perfil(is) oculto(s) pelo filtro de score</span> <span className="text-muted-foreground">({scoreLabel(deferred)})</span>
              <button onClick={resetScore} className="ml-2 underline underline-offset-2 hover:text-primary">Ajustar score</button>
            </p>
          )}
          {card === 'marcadas' && !picks.length && view !== 'todos' ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma sugestão marcada no momento.</p>
              <button onClick={() => { setCardRaw(null); setView('todos'); }} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Ver todos os perfis</button>
            </div>
          ) : !run.results.length ? (
            <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma vaga elegível com início em {label(run.month)}.</p>
          ) : !(view === 'todos' ? shown.todosRows : view === 'perfil' ? shown.perfilRows : shown.vagaRows).length ? (
            <EmptyFilters f={deferred} others={otherFilters(deferred, effCard ? CARDS[effCard] : null)} scoreGuilty={shown.scoreHidden > 0} onClear={clearAll} onScore={resetScore} />
          ) : view === 'todos' ? <Suggestions results={shown.todosRows} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} emptyText="Nenhum perfil elegível para esta vaga." initialRows={15} />
          : view === 'matriz' ? <MatrixView rows={shown.vagaRows} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} />
          : view === 'perfil' ? <PerfilView rows={shown.perfilRows} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} />
          : <Suggestions results={shown.vagaRows} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} emptyText="Nenhum perfil passou nos filtros eliminatórios." initialRows={5} />}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Escolha o mês e clique em “Fazer match” para ver as sugestões.</p>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar {picks.length} subitem(ns) de match?</AlertDialogTitle>
            <AlertDialogDescription>
              Cada sugestão marcada vira um subitem na vaga (Indicado(a) · Perfil indicado para a vaga - aguardando retorno · próxima rodada · mês {label(run?.month ?? month)}).
              Depois, as vagas e os perfis envolvidos passam para “Em rodada de match”.
              Antes de criar, os subitens atuais de cada vaga são reconsultados: perfis já vinculados são pulados e vagas já na Rodada 4 ficam de fora para avaliação manual.
              {hidden > 0 && <span className="mt-2 block font-medium text-foreground">{hidden} dessas sugestões estão ocultas pelos filtros atuais e também serão enviadas.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Aplicar e enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
