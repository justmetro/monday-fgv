import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApus } from '@generated/server/apus';
import type { ApusData } from '../../../server/apus';
import type { UserSessionInfo } from '@generated/server/storage';
import { errorText } from '@generated/lib/errorText';

export function useApus(session: UserSessionInfo | null) {
  const claim = useMemo(() => (session ? { id: session.id, email: session.email, name: session.name, isAdmin: session.isAdmin } : undefined), [session]);
  const [data, setData] = useState<ApusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (force = false) => {
    if (!session) return;
    setLoading(true);
    try {
      setData((await getApus({ data: { clientClaim: claim, force } })) as ApusData);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [claim, session]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}
