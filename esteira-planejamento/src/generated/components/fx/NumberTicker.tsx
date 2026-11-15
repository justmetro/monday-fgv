import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@lib/utils';

interface Props extends ComponentPropsWithoutRef<'span'> {
  value: number;
  decimalPlaces?: number;
  format?: (n: number) => string;
  /** Seconds before the first animation. */
  delay?: number;
}

const reduzido = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animated counter (Magic UI NumberTicker API, MIT). Counts up when it enters the viewport, then animates
 * from the CURRENT value to the new one when `value` changes (e.g. a filter). Writes the text directly
 * (no re-render per frame). With prefers-reduced-motion the final value is shown at once.
 */
export function NumberTicker({ value, decimalPlaces = 0, format, delay = 0, className, ...props }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const atual = useRef(0);
  const fmt = (n: number) => (format ? format(n) : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(n.toFixed(decimalPlaces))));
  const fmtRef = useRef(fmt);
  // Declared before the animation effect, so it always runs first with the latest formatter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fmtRef.current = fmt; }, [format, decimalPlaces]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const escrever = (n: number) => { atual.current = n; el.textContent = fmtRef.current(n); };
    if (reduzido() || !Number.isFinite(value)) { escrever(value); return; }
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const animar = () => {
      const de = atual.current;
      const dur = 900;
      const t0 = performance.now();
      const passo = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        escrever(k >= 1 ? value : de + (value - de) * e);
        if (k < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };
    let obs: IntersectionObserver | null = null;
    if (atual.current === 0 && typeof IntersectionObserver !== 'undefined') {
      obs = new IntersectionObserver((ents) => {
        if (ents.some((x) => x.isIntersecting)) { obs?.disconnect(); timer = setTimeout(animar, delay * 1000); }
      });
      obs.observe(el);
    } else animar();
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); obs?.disconnect(); };
  }, [value, delay]);

  return <span ref={ref} className={cn('inline-block tabular-nums', className)} {...props}>{fmt(0)}</span>;
}
