import { useEffect, useState } from 'react';
import { monday } from '@generated/lib/data';

const KEY = 'hub-theme-mode';
const readMode = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };

// monday theme: 'light' | 'dark' | 'black' (night)
export function useThemeMode() {
  const [mode, setModeState] = useState(readMode);
  const [mondayTheme, setMondayTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

  useEffect(() => {
    let off;
    try {
      off = monday.listen('context', (res) => { const t = res?.data?.theme; if (t) setMondayTheme(t); });
    } catch (e) { console.error('Não foi possível ler o tema do monday', e); }
    return () => { try { if (typeof off === 'function') off(); } catch { /* noop */ } };
  }, []);

  const resolved = mode === 'auto' ? (mondayTheme === 'light' ? 'light' : mondayTheme === 'black' ? 'night' : 'dark') : mode;

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = resolved !== 'light';
      if (root.classList.contains('dark') !== dark) root.classList.toggle('dark', dark);
      if (root.classList.contains('night') !== (resolved === 'night')) root.classList.toggle('night', resolved === 'night');
    };
    apply();
    // The host provider also toggles the class on context changes — keep our choice authoritative.
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [resolved]);

  const setMode = (m) => { setModeState(m); try { localStorage.setItem(KEY, m); } catch { /* noop */ } };
  return { mode, setMode, resolved };
}
