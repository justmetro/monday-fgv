import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCommunication, type CommunicationView } from '@generated/server/communication';
import type { UserSessionInfo } from '@generated/server/storage';
import { errorText } from '@generated/lib/errorText';
import type { TrendPoint } from '@generated/components/charts/WeeklyTrendChart';
import { brFromIso } from '@generated/lib/weeklySeries';

export function useCommunication(session: UserSessionInfo | null, weeks = 12) {
  const claim = useMemo(() => (session ? { id: session.id, email: session.email, name: session.name, isAdmin: session.isAdmin } : undefined), [session]);
  const [view, setView] = useState<CommunicationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!session) return;
    try {
      setView((await getCommunication({ data: { clientClaim: claim, weeks } })) as CommunicationView);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [claim, session, weeks]);
  useEffect(() => { void load(); }, [load]);
  return { view, error, loading, reload: load, claim };
}

/** Mensagens (updates + respostas) por semana, com média acumulada; codes filtra os projetos. */
export function communicationSeries(view: CommunicationView | null, codes?: Set<string>): TrendPoint[] {
  if (!view) return [];
  let sum = 0, n = 0;
  return [...view.weeks].reverse().map((w) => {
    const rows = view.rows.filter((r) => r.weekStart === w.weekStart && (!codes || codes.has(r.code)));
    const total = rows.reduce((s, r) => s + r.total, 0);
    sum += total; n++;
    return { label: w.week, range: `${brFromIso(w.weekStart)} a ${brFromIso(w.weekEnd)}`, bar: total, line: Math.round(sum / n) };
  });
}
