// Substitui useSearch/useNavigate do TanStack Router com a query string da página.
import { useEffect, useState } from 'react';
const EV = 'app-search-change';
function ler(): Record<string, string> { return Object.fromEntries(new URLSearchParams(window.location.search)); }
export function useSearch(_o?: unknown): Record<string, any> {
  const [s, setS] = useState(ler);
  useEffect(() => { const f = () => setS(ler()); window.addEventListener(EV, f); window.addEventListener('popstate', f); return () => { window.removeEventListener(EV, f); window.removeEventListener('popstate', f); }; }, []);
  return s;
}
export function useNavigate(_o?: unknown) {
  return (opts: { search?: Record<string, unknown> | ((prev: Record<string, any>) => Record<string, unknown>); replace?: boolean; to?: string }) => {
    const prev = ler();
    const next = typeof opts.search === 'function' ? opts.search(prev) : opts.search ?? prev;
    const qs = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(next)) { if (v === undefined || v === null || v === '') qs.delete(k); else qs.set(k, String(v)); }
    window.history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`);
    window.dispatchEvent(new Event(EV));
  };
}
