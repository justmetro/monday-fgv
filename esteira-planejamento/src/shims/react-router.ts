// Substitui useSearch/useNavigate do TanStack Router usando a query string da página.
// A busca passa pela mesma validação da rota do Vibe (routes/_app/index.tsx).
import { useEffect, useState } from 'react';
import { normalizarPer } from '@generated/lib/periodo';

const TABS = ['geral', 'prazos', 'financeiro', 'sgi', 'indicadores', 'alocacao'] as const;
const SUBS = ['disponibilidade', 'projecao', 'destinos', 'gantt', 'validacao', 'historico', 'registro'] as const;
const CHAVES = ['aba', 'sub', 'per'];
const EV = 'app-search-change';

function validar(search: Record<string, unknown>) {
  return {
    aba: search.aba === 'pendencias' ? 'sgi' : search.aba === 'carga' ? 'alocacao' : TABS.find((t) => t === search.aba),
    sub: search.sub === 'porGerente' || (search.aba === 'carga' && !search.sub) ? 'disponibilidade'
      : search.sub === 'jaAlocados' || search.sub === 'ja-alocados' ? 'projecao'
      : SUBS.find((s) => s === search.sub),
    per: normalizarPer(search.per as string | undefined),
  };
}
function bruto(): Record<string, string> {
  const qs = new URLSearchParams(window.location.search);
  return Object.fromEntries(CHAVES.filter((k) => qs.has(k)).map((k) => [k, qs.get(k)!]));
}
const ler = () => validar(bruto()) as Record<string, any>;

export function useSearch(_o?: unknown): Record<string, any> {
  const [s, setS] = useState(ler);
  useEffect(() => {
    const f = () => setS(ler());
    window.addEventListener(EV, f); window.addEventListener('popstate', f);
    return () => { window.removeEventListener(EV, f); window.removeEventListener('popstate', f); };
  }, []);
  return s;
}

export function useNavigate(_o?: unknown) {
  return (opts: { search?: Record<string, unknown> | ((prev: Record<string, any>) => Record<string, unknown>); replace?: boolean; to?: string }) => {
    const prev = ler();
    const next = typeof opts.search === 'function' ? opts.search(prev) : opts.search ?? prev;
    const qs = new URLSearchParams(window.location.search);
    for (const k of CHAVES) qs.delete(k);
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    window.history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`);
    window.dispatchEvent(new Event(EV));
  };
}
