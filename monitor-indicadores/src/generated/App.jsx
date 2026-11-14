import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@components/ui/skeleton';
import { Toaster } from '@components/ui/sonner';
import { TooltipProvider } from '@components/ui/tooltip';
import { readLight } from '@generated/ExportButton';
import { exportSlidesPdf } from '@generated/pdfExport';
import { MESES } from '@generated/lib';
import { useTheme } from '@generated/useTheme';
import { closedMeds, projYear, lastMonth } from '@generated/calc';
import { buildFiltro } from '@generated/scope';
import { useIndicadores } from '@generated/useIndicadores';
import Header from '@generated/Header';
import ReportView, { ReportSlide, reportPages } from '@generated/ReportView';
import IndicatorView, { IndicatorSlide } from '@generated/IndicatorView';
import SummaryView, { SummarySlide, summaryPages } from '@generated/SummaryView';
import QualityView from '@generated/QualityView';
import DetailSheet from '@generated/DetailSheet';
import Presentation from '@generated/Presentation';
import CommandPalette, { useCommandShortcut } from '@generated/CommandPalette';
import { qualityIssues } from '@generated/quality';

const NIVEL_KEY = 'indicadores-nivel';
const readNivel = () => { try { const v = localStorage.getItem(NIVEL_KEY); return ['tat', 'op', 'all'].includes(v) ? v : 'tat'; } catch { return 'tat'; } };
const NIVEL_MATCH = { tat: (i) => i.nivel === 'Tático', op: (i) => i.nivel === 'Operacional', all: () => true };
const ANO_CORRENTE = new Date().getFullYear();
/** views saved before the single period filter: { year, mode, month } → { g, p, year } */
const legacyFiltro = (v, fallbackP) => ({ g: v.mode === 'q' ? 'q' : v.mode === 'y' ? 'y' : 'm', p: v.mode === 'q' ? Math.floor((v.month ?? fallbackP) / 3) : (v.month ?? fallbackP), year: v.year ?? ANO_CORRENTE });

export default function App() {
  const theme = useTheme();
  const { loading, refetching, error, ind: allInd, raw, projects, carga, updatedAt, reload } = useIndicadores();
  const [nivel, setNivelState] = useState(readNivel);
  const setNivel = (v) => { setNivelState(v); try { localStorage.setItem(NIVEL_KEY, v); } catch (e) { console.error(e); } };
  const [hidden, setHidden] = useState([]);
  const nivelInd = useMemo(() => allInd.filter(NIVEL_MATCH[nivel]), [allInd, nivel]);
  const ind = useMemo(() => nivelInd.filter((i) => !hidden.includes(i.id)), [nivelInd, hidden]);
  // period filter — default on open: Mensal · last closed month · current year
  const [filtroRaw, setFiltro] = useState(null);
  useEffect(() => { if (!loading && !filtroRaw) setFiltro({ g: 'm', p: lastMonth(allInd, ANO_CORRENTE), year: ANO_CORRENTE }); }, [loading, filtroRaw, allInd]);
  const f = useMemo(() => buildFiltro(filtroRaw ?? { g: 'm', p: new Date().getMonth(), year: ANO_CORRENTE }), [filtroRaw]);
  const year = f.year;
  const lastClosed = useMemo(() => lastMonth(ind, year), [ind, year]);
  const partialMonths = useMemo(() => [...new Set(ind.flatMap((i) => i.meds.filter((m) => m.period.year === year && m.parcial).map((m) => m.period.month)))], [ind, year]);
  const [pdf, setPdf] = useState(null);
  const [tab, setTab] = useState('report');
  const [showAlerts, setShowAlerts] = useState(true);
  const [detail, setDetail] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const closePresent = useCallback(() => setPresenting(false), []);
  const [cmdOpen, setCmdOpen] = useState(false);
  useCommandShortcut(setCmdOpen);
  const years = [...new Set([ANO_CORRENTE, ANO_CORRENTE - 1, ...allInd.flatMap((i) => i.meds.map((m) => m.period.year))])].sort((a, b) => b - a);
  const issues = useMemo(() => qualityIssues(raw, ind, year), [raw, ind, year]);
  const props = { ind, year, f, lastClosed, updatedAt, showAlerts, nivel, onOpen: setDetail };
  const slides = useMemo(() => !ind.length ? [] : [
    ...reportPages(ind, f.g).map((pg, k, all) => <ReportSlide key={`r-${pg.groups.map((o) => `${o.id}:${o.inds[0]?.code}`).join('|')}`} {...props} groups={pg.groups} dense={pg.dense} page={{ n: k + 1, total: all.length }} />),
    ...summaryPages(ind).map((g, k, all) => <SummarySlide key={`s-${g[0]?.code ?? 'vazio'}`} {...props} ind={g} page={{ n: k + 1, total: all.length }} />),
    ...ind.filter((i) => i.meds.some((m) => m.period.year === year)).map((i) => <IndicatorSlide key={i.code} i={i} {...props} />),
  ], [ind, f, lastClosed, updatedAt, nivel]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportPdf = async () => {
    setPdf({ n: 0, total: slides.length });
    try {
      await exportSlidesPdf(slides, { light: readLight(), fileName: `indicadores-${f.short.replace(/[^\w.-]+/g, '-').toLowerCase()}.pdf`, onProgress: (n, total) => setPdf({ n, total }) });
      toast.success('PDF gerado');
    } catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF.'); }
    setPdf(null);
  };

  const viewState = { filtro: { g: f.g, p: f.p, year: f.year }, nivel, showAlerts, hidden };
  const applyView = (v) => {
    setFiltro(v.filtro ?? legacyFiltro(v, lastClosed));
    if (v.nivel) setNivel(v.nivel);
    setShowAlerts(v.showAlerts ?? true);
    setHidden(v.hidden ?? []);
    setTab('report');
  };

  const monthsWithData = useMemo(() => [...new Set(ind.flatMap((i) => i.meds.filter((m) => m.period.year === year).map((x) => x.period.month)))].sort((a, b) => a - b), [ind, year]);
  const [liveMsg, setLiveMsg] = useState('');
  const prevIssues = useRef(null);
  useEffect(() => {
    if (loading) return;
    if (prevIssues.current !== null && prevIssues.current !== issues.length) setLiveMsg(`${issues.length.toLocaleString('pt-BR')} pendências de dados`);
    prevIssues.current = issues.length;
  }, [issues.length, loading]);

  const openIndicator = (i) => {
    const v = closedMeds(ind.find((x) => x.id === i.id) ?? i, year);
    const mm = v.length ? v[v.length - 1].period.month : lastMonth([i], year);
    setDetail({ code: i.code, months: [mm], label: `${MESES[mm]}/${String(year).slice(2)}` });
  };
  const openProject = (p) => {
    const y = projYear(p) ?? year;
    if (y !== year) setFiltro({ g: f.g, p: f.p, year: y });
    const code = ind.some((i) => i.code === 'IT1.1') ? 'IT1.1' : ind.find((i) => i.code.startsWith('IT1.'))?.code;
    if (code) setDetail({ code, months: [p.mes], label: `${MESES[p.mes]}/${String(y).slice(2)}` });
  };

  const tabs = [['report', 'Visão relatório'], ['ind', 'Indicador'], ['sum', 'Resumo'], ['qual', 'Qualidade dos dados', issues.length || null]];
  const s = { tab, setTab, tabs, carga, updatedAt, reload, loading, refetching, error, theme, pdf, exportPdf, slideCount: slides.length,
    present: () => setPresenting(true), openSearch: () => setCmdOpen(true), nivel, setNivel, years, f, setFiltro, lastClosed, partialMonths,
    showAlerts, setShowAlerts, viewState, applyView, nivelInd, hidden, setHidden };
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background font-[family-name:var(--font-body)] text-foreground">
        <span className="sr-only" aria-live="polite">{liveMsg}</span>
        <div className="mx-auto max-w-[1340px] px-4 py-5 sm:px-6">
          <Header s={s} />
          <div className="mt-4">
            {error ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-destructive">{error}</p>
              : loading ? <Skeleton className="h-[640px] w-full rounded-2xl" />
              : tab === 'report' ? <ReportView {...props} />
              : tab === 'ind' ? <IndicatorView {...props} />
              : tab === 'sum' ? <SummaryView {...props} />
              : <QualityView issues={issues} />}
          </div>
        </div>
        <DetailSheet detail={detail} onClose={() => setDetail(null)} ind={ind} raw={raw} projects={projects} year={year} onSaved={reload} />
        {presenting && <Presentation slides={slides} onClose={closePresent} />}
        <CommandPalette open={cmdOpen} setOpen={setCmdOpen} ind={ind} year={year} months={monthsWithData} projects={projects}
          onIndicator={openIndicator} onProject={openProject}
          onMonthReport={(mm) => { setFiltro({ g: 'm', p: mm, year }); setTab('report'); }}
          actions={{ present: () => setPresenting(true), pdf: exportPdf, reload, theme: theme.cycle, quality: () => setTab('qual'), issues: issues.length }} />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
