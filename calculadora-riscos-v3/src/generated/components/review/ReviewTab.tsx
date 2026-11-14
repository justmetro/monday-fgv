import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { toast } from 'sonner';
import { ListChecks } from 'lucide-react';
import { getReviewRisks, getRiskFilterOptions, updateRisk } from '@generated/data/risks';
import { Skeleton } from '@components/ui/skeleton';
import { EmptyNote } from '@generated/components/kit';
import { ALL, emptyFilters, ReviewFilters, type ReviewFilterState } from '@generated/components/review/ReviewFilters';
import { ReviewRow, type ReviewRisk } from '@generated/components/review/ReviewRow';
import { NotApplicableTable } from '@generated/components/review/NotApplicableTable';
import { splitLabels, type Aplicabilidade } from '@generated/lib/config';
import { useWriteMode } from '@generated/lib/write-mode';

const v = (s: string) => (s === ALL ? undefined : s);

export function ReviewTab({ projectId, total, onAplicChange }: { projectId: string; total: number; onAplicChange: (from: string | null, to: string | null) => void }) {
  const { readOnly, reportWriteError } = useWriteMode();
  const [filters, setFilters] = useState<ReviewFilterState>(emptyFilters);
  const search = useDebounce(filters.search, 300);
  const [items, setItems] = useState<ReviewRisk[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ categorias: string[]; grupos: string[]; aplicabilidades: string[] }>({ categorias: [], grupos: [], aplicabilidades: [] });
  const loaded = useRef(false);
  // Pedido para abrir o editor de justificativa na seção Não aplicáveis (nonce permite reabrir para o mesmo risco).
  const [justifRequest, setJustifRequest] = useState<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    getRiskFilterOptions({ data: { projectId } })
      .then((o) =>
        setOptions({
          categorias: splitLabels(o?.categorias ?? []),
          grupos: splitLabels(o?.grupos ?? []),
          aplicabilidades: splitLabels(o?.aplicabilidades ?? []),
        }),
      )
      .catch((e: unknown) => console.error('Erro ao carregar opções de filtro', e));
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (loaded.current) setRefetching(true);
    else setLoading(true);
    setError(null);
    getReviewRisks({
      data: {
        projectId,
        search: search || undefined,
        categoria: v(filters.categoria),
        grupo: v(filters.grupo),
        nivel: v(filters.nivel),
        aplicabilidade: v(filters.aplicabilidade),
        sort: filters.sort,
      },
    })
      .then((res) => {
        if (!active) return;
        setItems(res?.items ?? []);
        setTruncated(Boolean(res?.truncated));
        loaded.current = true;
      })
      .catch((e: unknown) => {
        console.error('Erro ao carregar riscos', e);
        if (active) setError('Não foi possível carregar os riscos do quadro 09.4.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefetching(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, search, filters.categoria, filters.grupo, filters.nivel, filters.aplicabilidade, filters.sort]);

  const patchLocal = (id: string, patch: Partial<ReviewRisk>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const setAplic = async (risk: ReviewRisk, next: Aplicabilidade | 'Identificado') => {
    if (readOnly) return;
    const prev = risk.aplicabilidade;
    patchLocal(risk.id, { aplicabilidade: next });
    onAplicChange(prev, next);
    const pedirJustificativa = next === 'Não aplicável' && !risk.justificativaDaAplicabilidade?.trim();
    if (pedirJustificativa) setJustifRequest({ id: risk.id, nonce: Date.now() });
    try {
      await updateRisk({ data: { itemId: risk.id, patch: { aplicabilidade: next } } });
      if (next === 'Não aplicável') {
        toast.success(`${risk.idDoRisco ?? 'Risco'} movido para Não aplicáveis. Registre a justificativa.`, {
          action: { label: 'Desfazer', onClick: () => void setAplic({ ...risk, aplicabilidade: next }, (prev as Aplicabilidade) || 'Identificado') },
        });
      }
    } catch (e) {
      patchLocal(risk.id, { aplicabilidade: prev });
      onAplicChange(next, prev);
      if (pedirJustificativa) setJustifRequest((r) => (r?.id === risk.id ? null : r));
      reportWriteError(e);
    }
  };

  const saveJustif = async (risk: ReviewRisk, text: string) => {
    if (readOnly) return false;
    const prev = risk.justificativaDaAplicabilidade;
    patchLocal(risk.id, { justificativaDaAplicabilidade: text });
    try {
      await updateRisk({ data: { itemId: risk.id, patch: { justificativa: text } } });
      return true;
    } catch (e) {
      patchLocal(risk.id, { justificativaDaAplicabilidade: prev });
      reportWriteError(e);
      return false;
    }
  };

  const ativos = items.filter((i) => i.aplicabilidade !== 'Não aplicável');
  const naoAplic = items.filter((i) => i.aplicabilidade === 'Não aplicável');

  if (!loading && !error && total === 0 && items.length === 0) {
    return (
      <EmptyNote title="Nenhum risco gerado para este projeto" icon={<ListChecks className="size-6" />}>
        O motor cria os riscos no quadro 09.4 quando o status “Calculadora” do 09.1 vai para “Executar”. Depois da execução, eles aparecem aqui para revisão.
      </EmptyNote>
    );
  }

  return (
    <div>
      <ReviewFilters value={filters} onChange={setFilters} refetching={refetching} {...options} />
      {error && <p className="mt-4 text-sm text-[hsl(var(--destructive))]">{error}</p>}
      {truncated && <p className="mt-4 text-xs text-[hsl(var(--warning))]">Este projeto tem muitos riscos; apenas os 2.000 primeiros foram carregados.</p>}

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Riscos para revisão</h2>
        <span className="mono text-xs text-muted-foreground">{ativos.length} na lista</span>
      </div>

      {loading ? (
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex gap-4 rounded-xl border border-[hsl(var(--border))] p-4">
              <Skeleton className="h-12 w-14" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="hidden h-9 w-[320px] rounded-full md:block" />
            </li>
          ))}
        </ul>
      ) : ativos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--border))] px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum risco pendente com os filtros atuais. Ajuste os filtros ou consulte a seção de não aplicáveis abaixo.
        </p>
      ) : (
        <ul className={`mt-3 space-y-2 transition-opacity ${refetching ? 'opacity-60' : ''}`}>
          {ativos.map((r) => (
            <ReviewRow key={r.id} risk={r} readOnly={readOnly} onAplic={(n) => void setAplic(r, n)} onSaveJustif={(t) => saveJustif(r, t)} />
          ))}
        </ul>
      )}

      {!loading && (
        <NotApplicableTable
          items={naoAplic}
          readOnly={readOnly}
          justifRequest={readOnly ? null : justifRequest}
          onReevaluate={(r) => void setAplic(r, 'Em avaliação')}
          onSaveJustif={saveJustif}
        />
      )}
    </div>
  );
}
