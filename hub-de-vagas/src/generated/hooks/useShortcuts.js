import { useEffect, useRef } from 'react';

const INTERACTIVE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role=combobox], [role=listbox], [role=menu], [role=option], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=slider], [role=spinbutton]';
const OVERLAY = '[data-radix-popper-content-wrapper], [role=menu], [role=listbox], [role=dialog], [role=alertdialog], [data-state=open][data-slot=popover-content]';
// Shortcuts are off whenever focus is in an interactive control or a popover/menu/dialog is open.
const busy = (target) => {
  const el = target instanceof Element ? target : document.activeElement;
  if (el?.isContentEditable || el?.closest?.(INTERACTIVE)) return true;
  const act = document.activeElement;
  if (act && act !== el && (act.isContentEditable || act.closest?.(INTERACTIVE))) return true;
  return !!document.querySelector(OVERLAY);
};

// Ctrl/⌘+K search · G then H/V/P/O/R navigation · Esc back · ? help
export function useShortcuts(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    let gAt = 0;
    const onKey = (e) => {
      const h = ref.current;
      if (busy(e.target)) return; // Esc etc. belong to the focused control / open overlay
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); h.search(); return; }
      if (e.key === 'Escape') { h.escape(e); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') { e.preventDefault(); h.help(); return; }
      const k = e.key.toLowerCase();
      if (k === 'g') { gAt = Date.now(); return; }
      if (Date.now() - gAt < 1200) {
        const map = { h: 'today', v: 'vagas', p: 'perfis', o: 'overview' };
        if (map[k]) { e.preventDefault(); h.goto(map[k]); }
        gAt = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
