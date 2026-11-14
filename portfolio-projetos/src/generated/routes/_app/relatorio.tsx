import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { useDataset } from '@generated/hooks/useDataset';
import { getClassState } from '@generated/server/intel';
import { buildReport, DEFAULT_CFG, type IntelConfig, type Report } from '@generated/lib/intel';
import { refDateFortaleza } from '@generated/lib/intel-sig';
import { ErrorBox, PageSkeleton } from '@generated/components/States';
import { ConfigStep } from '@generated/components/intel/ConfigStep';
import { ClassifyStep } from '@generated/components/intel/ClassifyStep';
import { ReviewStep } from '@generated/components/intel/ReviewStep';
import { ReportView } from '@generated/components/intel/ReportView';
import { cn } from '@lib/utils';

export const Route = createFileRoute('/_app/relatorio')({ component: IntelPage });

type ClassState = Awaited<ReturnType<typeof getClassState>>;
const STEPS = ['Configurar', 'Classificar indicadores', 'Revisar agrupamentos', 'Visualizar relatório'];

function IntelPage() {
  const { model, loading, error, reload } = useDataset();
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<IntelConfig>(DEFAULT_CFG);
  const [cs, setCs] = useState<ClassState | null>(null);
  const [csErr, setCsErr] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const loadClasses = useCallback(async () => {
    setCsErr(null);
    try { setCs((await getClassState({ data: {} })) ?? { classes: [], versao: 1 }); }
    catch (e) { console.error(e); setCsErr('Não foi possível carregar as classificações salvas.'); }
  }, []);
  useEffect(() => { void loadClasses(); }, [loadClasses]);

  // Indicadores do recorte (para classificar/revisar) — a mesma regra de escopo do relatório.
  const scope = useMemo(() => (model && cs ? buildReport(model.ds, cs.classes, cfg, refDateFortaleza(), cs.versao) : null), [model, cs, cfg]);

  const generate = () => {
    if (!model || !cs) return;
    // Data de referência fixada: prévia e PDF usam exatamente este objeto.
    setReport(buildReport(model.ds, cs.classes, cfg, refDateFortaleza(), cs.versao));
    setStep(3);
  };

  if (loading) return <PageSkeleton />;
  if (error && !model) return <ErrorBox message={error} onRetry={reload} />;
  if (!model) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/indicadores" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Indicadores e medições</Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Relatório de inteligência dos indicadores</h1>
        <p className="mt-1 text-sm text-muted-foreground">Padrões temáticos, famílias recorrentes e diferenças de alcance de metas — carteira, eixos e comparação entre eixos.</p>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => (i < 3 ? setStep(i) : report && setStep(3))} disabled={i === 3 && !report}
              className={cn('flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm disabled:opacity-40', step === i ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card')}>
              <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', i < step ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{i < step ? <Check className="size-3" aria-hidden /> : i + 1}</span>{s}
            </button>
          </li>
        ))}
      </ol>
      {csErr && <ErrorBox message={csErr} onRetry={() => void loadClasses()} />}
      {step === 0 && <ConfigStep projects={model.ds.projects} cfg={cfg} setCfg={setCfg} onNext={() => setStep(1)} />}
      {step === 1 && scope && cs && <ClassifyStep scope={scope.overall.indicators} classes={cs.classes} onChanged={loadClasses} onNext={() => setStep(2)} />}
      {step === 2 && scope && cs && <ReviewStep scope={scope.overall.indicators} projects={model.ds.projects} classes={cs.classes} onChanged={loadClasses} onNext={generate} />}
      {step === 3 && report && <ReportView report={report} onRegenerate={generate} />}
    </div>
  );
}
