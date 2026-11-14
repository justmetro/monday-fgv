import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getTreatmentRisks, updateRisk, type RiskPatch } from '@generated/data/risks';
import { Skeleton } from '@components/ui/skeleton';
import { EmptyNote, Eyebrow } from '@generated/components/kit';
import { draftFrom, flagsOf, TreatmentCard, type TreatmentRisk } from '@generated/components/treatment/TreatmentCard';
import type { Draft } from '@generated/components/treatment/TreatmentForm';
import { ESCALA, ESTRATEGIAS, isCritico, LIMITE_CRITICO, STATUS_TRATAMENTO } from '@generated/lib/config';
import { useWriteMode } from '@generated/lib/write-mode';
import { cn } from '@lib/utils';

type View = 'todos' | 'criticos' | 'pendencias';
type Escala = (typeof ESCALA)[number];
type Estrategia = (typeof ESTRATEGIAS)[number];
type StatusTrat = (typeof STATUS_TRATAMENTO)[number];

export function TreatmentTab({ projectId }: { projectId: string }) {
  const { readOnly, reportWriteError } = useWriteMode();
  const [items, setItems] = useState<TreatmentRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('todos');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTreatmentRisks({ data: { projectId } })
      .then((res) => active && setItems(res?.items ?? []))
      .catch((e: unknown) => {
        console.error('Erro ao carregar riscos aplicáveis', e);
        if (active) setError('Não foi possível carregar os riscos aplicáveis.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  const save = async (risk: TreatmentRisk, d: Draft): Promise<boolean> => {
    if (readOnly) return false;
    const base = draftFrom(risk);
    const patch: RiskPatch = {};
    if (d.probabilidade !== base.probabilidade) patch.probabilidade = d.probabilidade as Escala | null;
    if (d.impacto !== base.impacto) patch.impacto = d.impacto as Escala | null;
    if (d.estrategia !== base.estrategia) patch.estrategia = d.estrategia as Estrategia | null;
    if (d.statusTratamento !== base.statusTratamento) patch.statusTratamento = d.statusTratamento as StatusTrat | null;
    if (d.resposta !== base.resposta) patch.resposta = d.resposta;
    if (d.periodicidade !== base.periodicidade) patch.periodicidade = d.periodicidade;
    if (d.prazo !== base.prazo) patch.prazo = d.prazo || null;
    if (JSON.stringify(d.responsaveis) !== JSON.stringify(base.responsaveis)) patch.responsaveis = d.responsaveis.map((p) => p.id);

    const prev = risk;
    const optimistic: TreatmentRisk = {
      ...risk,
      probabilidade: d.probabilidade,
      impacto: d.impacto,
      estratgia: d.estrategia,
      statusDoTratamento: d.statusTratamento,
      respostaPlanoDeAo: d.resposta,
      periodicidade: d.periodicidade,
      prazo: d.prazo ? new Date(`${d.prazo}T00:00:00Z`) : null,
      responsvelPeloMonitoramento: d.responsaveis.map((p) => ({ id: p.id, kind: 'person' as const, name: p.name })),
    };
    setItems((list) => list.map((i) => (i.id === risk.id ? optimistic : i)));
    try {
      const res = await updateRisk({ data: { itemId: risk.id, patch } });
      setItems((list) =>
        list.map((i) =>
          i.id === risk.id ? { ...i, grauDeRisco: res?.grauDeRisco ?? i.grauDeRisco, nvelDeRisco: res?.nvelDeRisco ?? i.nvelDeRisco } : i,
        ),
      );
      toast.success(`Tratamento de ${risk.idDoRisco ?? 'risco'} salvo no 09.4`);
      return true;
    } catch (e) {
      setItems((list) => list.map((i) => (i.id === risk.id ? prev : i)));
      reportWriteError(e);
      return false;
    }
  };

  const criticos = items.filter((i) => isCritico(i.grauDeRisco)).length;
  const pendencias = items.filter((i) => Object.values(flagsOf(i)).some(Boolean)).length;
  // Recorte de visualização sobre o conjunto COMPLETO de aplicáveis já carregado (não é uma página parcial).
  const visible = view === 'criticos' ? items.filter((i) => isCritico(i.grauDeRisco)) : view === 'pendencias' ? items.filter((i) => Object.values(flagsOf(i)).some(Boolean)) : items;

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>;
  if (items.length === 0) {
    return (
      <EmptyNote title="Nenhum risco aplicável ainda" icon={<ShieldCheck className="size-6" />}>
        Marque riscos como “Aplicável” na aba Revisão. Eles aparecem aqui para definir probabilidade, impacto, estratégia e plano de ação.
      </EmptyNote>
    );
  }

  const views: { key: View; label: string; n: number }[] = [
    { key: 'todos', label: 'Todos aplicáveis', n: items.length },
    { key: 'criticos', label: `Críticos (grau ≥ ${LIMITE_CRITICO})`, n: criticos },
    { key: 'pendencias', label: 'Com pendências', n: pendencias },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Tratamento · ordenado pelo grau do quadro</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Riscos aplicáveis</h2>
        </div>
        <div role="group" aria-label="Recorte da lista" className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              onClick={() => setView(v.key)}
              className={cn('ghost-pill', view === v.key && 'border-[hsl(var(--cobalt))] bg-[hsl(var(--surface-deep))] text-[hsl(var(--sky))]')}
            >
              {v.label} <span className="tabular-nums opacity-70">{v.n}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] px-5 py-8 text-center text-sm text-muted-foreground">Nenhum risco neste recorte.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((r) => (
            <TreatmentCard key={r.id} risk={r} readOnly={readOnly} onSave={(d) => save(r, d)} />
          ))}
        </ul>
      )}
    </div>
  );
}
