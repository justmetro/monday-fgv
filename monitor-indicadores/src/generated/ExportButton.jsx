import { useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@components/ui/switch';
import { InteractiveCtx } from '@generated/tip';

const KEY = 'indicadores-export-claro';
export const readLight = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

/** run capture with the node forced to light (slide-light) or the current theme */
async function capture(node, light, fn) {
  node.classList.add('capturing');
  if (light) node.classList.add('slide-light');
  void node.offsetHeight; // force style recalc before reading computed colors
  try {
    const bg = light ? '#ffffff' : `hsl(${getComputedStyle(node).getPropertyValue('--background').trim()})`;
    return await fn(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
  } finally {
    if (light) node.classList.remove('slide-light');
    node.classList.remove('capturing');
  }
}

export default function ExportButton({ targetRef, fileName = 'slide' }) {
  const [busy, setBusy] = useState(null);
  const [light, setLight] = useState(readLight);
  const toggle = (v) => { setLight(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { console.error(e); } };
  const copy = async () => {
    setBusy('copy');
    try {
      const blob = await capture(targetRef.current, light, toBlob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Imagem copiada');
    } catch (e) { console.error(e); toast.error('Não foi possível copiar. Use "Baixar PNG".'); }
    setBusy(null);
  };
  const download = async () => {
    setBusy('dl');
    try {
      const url = await capture(targetRef.current, light, toPng);
      const a = document.createElement('a'); a.href = url; a.download = `${fileName}.png`; a.click();
    } catch (e) { console.error(e); toast.error('Falha ao gerar a imagem.'); }
    setBusy(null);
  };
  const cls = 'inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50';
  const id = `export-light-${fileName}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Switch id={id} checked={light} onCheckedChange={toggle} /><label htmlFor={id}>Exportar em tema claro</label>
      </div>
      <button className={cls} onClick={copy} disabled={!!busy}>
        {busy === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copiar como imagem
      </button>
      <button className={cls} onClick={download} disabled={!!busy}>
        {busy === 'dl' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PNG
      </button>
    </div>
  );
}

export function Slide({ slideRef, children }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-muted/40 p-3">
      <div ref={slideRef} className="relative h-[720px] w-[1280px] overflow-hidden bg-background text-foreground font-[family-name:var(--font-body)]">
        <InteractiveCtx.Provider value>{children}</InteractiveCtx.Provider>
      </div>
    </div>
  );
}
