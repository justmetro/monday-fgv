import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

export default function Presentation({ slides, onClose }) {
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const closed = useRef(false);
  const entered = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => { if (closed.current) return; closed.current = true; onCloseRef.current?.(); }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, (window.innerHeight - 40) / 720));
    fit();
    window.addEventListener('resize', fit);
    const onFs = () => { if (fsElement()) entered.current = true; else if (entered.current) close(); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    const el = document.documentElement;
    try { (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {}); } catch (e) { console.error(e); }
    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      if (fsElement()) (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())?.catch?.(() => {});
    };
  }, [close]); // close is stable (empty deps) → runs once

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') close();
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) setIdx((i) => Math.min(slides.length - 1, i + 1));
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [slides.length, close]);

  const go = (d) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <button type="button" aria-label="Avançar ou voltar slide" onClick={(e) => go(e.clientX > window.innerWidth / 2 ? 1 : -1)}
        className="block cursor-pointer" style={{ width: 1280 * scale, height: 720 * scale }}>
        <div className="pointer-events-none h-[720px] w-[1280px] origin-top-left overflow-hidden bg-background text-left text-foreground font-[family-name:var(--font-body)]" style={{ transform: `scale(${scale})` }}>
          {slides[idx]}
        </div>
      </button>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
        <button aria-label="Anterior" onClick={() => go(-1)} className="rounded p-1 hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
        <span className="tabular-nums">{idx + 1}/{slides.length}</span>
        <button aria-label="Próximo" onClick={() => go(1)} className="rounded p-1 hover:bg-muted"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <button aria-label="Sair" onClick={close} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
    </div>
  );
}
