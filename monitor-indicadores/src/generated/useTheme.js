import { useEffect, useState } from 'react';

const KEY = 'indicadores-theme';
export const THEME_CYCLE = ['auto', 'light', 'dark'];
const read = () => { try { const v = localStorage.getItem(KEY); return THEME_CYCLE.includes(v) ? v : 'auto'; } catch { return 'auto'; } };

/** auto → follows prefers-color-scheme (listens for changes) */
export function useTheme() {
  const [mode, setMode] = useState(read);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (e) => setSystemDark(e.matches);
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  const dark = mode === 'dark' || (mode === 'auto' && systemDark);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const cycle = () => setMode((m) => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(m) + 1) % THEME_CYCLE.length];
    try { localStorage.setItem(KEY, next); } catch (e) { console.error(e); }
    return next;
  });
  return { mode, dark, cycle };
}
