// Navegação simples em memória (substitui o TanStack Router do Vibe).
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

let route: { path: string; params: Record<string, string> } = { path: '/', params: {} };
const subs = new Set<() => void>();
export function navigate(path: string, params: Record<string, string> = {}) {
  route = { path, params };
  subs.forEach((f) => f());
  window.scrollTo?.(0, 0);
}
export function useRoute() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => route);
}
export const useParams = () => useRoute().params;

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string>; activeOptions?: unknown };
export function Link({ to, params, activeOptions: _a, onClick, ...rest }: LinkProps) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); onClick?.(e); navigate(to, params ?? {}); };
  return <a href="#" {...rest} onClick={go} />;
}
