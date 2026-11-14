import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import type { PanelUploadMetrics } from '@generated/models';

const KIND_LABEL: Record<string, string> = {
  timeout: 'Tempo esgotado',
  rede: 'Conexão',
  limite_requisicoes: 'Limite de requisições',
  complexidade: 'Complexidade',
  tamanho: 'Tamanho da chamada',
  servidor: 'Erro temporário do monday',
  autorizacao: 'Autorização',
  valor_coluna: 'Valor de coluna',
  outro: 'Outros',
};

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export function errorsSummary(errors: Record<string, number> | undefined): string {
  const entries = Object.entries(errors ?? {}).filter(([, n]) => n > 0);
  return entries.length ? entries.map(([k, n]) => `${KIND_LABEL[k] ?? k}: ${n}`).join(' · ') : 'Nenhum';
}

interface Props {
  metrics: PanelUploadMetrics | null;
  activeSince: number | null; // quando definido, o cronômetro anda ao vivo
  elapsedBefore: number;
  createdTotal: number;
  settings: { itemsPerCall: number; parallelCalls: number };
}

export function PanelUploadMetricsView({ metrics, activeSince, elapsedBefore, createdTotal, settings }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSince) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSince]);

  // Durante a gravação o tempo corre desde o início desta etapa, somado ao das etapas anteriores
  const elapsed = activeSince ? elapsedBefore + Math.max(0, now - activeSince) : metrics?.elapsedMs ?? 0;
  const ips = elapsed > 0 ? createdTotal / (elapsed / 1000) : 0;
  const history = metrics?.itemsPerCallHistory?.length ? metrics.itemsPerCallHistory : [settings.itemsPerCall];

  const cells: [string, string][] = [
    ['Tempo decorrido', formatElapsed(elapsed)],
    ['Itens por segundo', ips.toLocaleString('pt-BR', { maximumFractionDigits: 2 })],
    ['Itens por chamada', history.join(' → ')],
    ['Chamadas em paralelo', String(metrics?.parallelCalls ?? settings.parallelCalls)],
    ['Chamadas feitas', String(metrics?.calls ?? 0)],
    ['Tentativas repetidas', String(metrics?.retries ?? 0)],
    ['Conferências do grupo', String(metrics?.verifications ?? 0)],
  ];

  return (
    <div className="rounded-2xl border border-border bg-[hsl(var(--brand-sky-2))] p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
        <Gauge className="w-3.5 h-3.5" /> Métricas da gravação
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cells.map(([l, v]) => (
          <div key={l} className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{l}</p>
            <p className="text-sm font-semibold text-[hsl(var(--brand-navy))] tabular-nums truncate" title={v}>{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Erros por tipo: {errorsSummary(metrics?.errorsByKind)}</p>
    </div>
  );
}
