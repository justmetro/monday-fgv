// Substitui @vibe/db/client com TanStack Query. As chaves ganham o prefixo 'vibedb', como no Vibe.
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

export const vibeQueryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 } } });
export { QueryClientProvider };

export function useVibeQuery<T>(key: readonly unknown[], fn: () => Promise<T>, opts: { collections?: string[]; enabled?: boolean } = {}) {
  return useQuery<T>({ queryKey: ['vibedb', ...key], queryFn: fn, enabled: opts.enabled ?? true });
}
