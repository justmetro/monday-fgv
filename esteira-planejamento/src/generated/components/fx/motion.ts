import { useCallback, useEffect, useRef, useState } from 'react';

const reduz = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True when the user asked for reduced motion (updates live). */
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

/** Troca de aba direta (a View Transition foi retirada por desempenho). */
export function comTransicao(fn: () => Promise<unknown> | void) {
  void fn();
}

/** Sliding tab indicator: put `navRef` on a relative nav and render <span ref={indRef} className="fx-tab-ind" />. */
export function useTabIndicator(ativo: string) {
  // Callback ref: the nav may mount after a loading state, so measuring re-runs when it appears.
  const [nav, navRef] = useState<HTMLElement | null>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const medir = useCallback(() => {
    const ind = indRef.current;
    const btn = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !ind) return;
    if (!btn) { ind.style.width = '0px'; return; }
    ind.style.left = `${btn.offsetLeft}px`;
    ind.style.width = `${btn.offsetWidth}px`;
  }, [nav]);
  useEffect(() => { medir(); }, [ativo, medir]);
  useEffect(() => {
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' && nav ? new ResizeObserver(medir) : null;
    if (ro && nav) ro.observe(nav);
    return () => { window.removeEventListener('resize', medir); ro?.disconnect(); };
  }, [medir, nav]);
  return { navRef, indRef };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Highlights the rows/cards with data-item-id = id for 1.5 s (after save / confirmed projection). */
export function piscar(id: string) {
  if (typeof document === 'undefined' || reduz()) return;
  requestAnimationFrame(() => {
    const els = document.querySelectorAll<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
    els.forEach((el) => { el.classList.remove('fx-saved'); void el.offsetWidth; el.classList.add('fx-saved'); });
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.set(id, setTimeout(() => {
      document.querySelectorAll(`[data-item-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.remove('fx-saved'));
      timers.delete(id);
    }, 1500));
  });
}
