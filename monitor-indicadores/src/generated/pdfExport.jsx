import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toPng } from 'html-to-image';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders each slide off-screen (1280×720), captures it and builds ONE 16:9 PDF.
 * light → captured with .slide-light on a white background; otherwise current theme background.
 */
export async function exportSlidesPdf(slides, { light, fileName, onProgress }) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1280px;height:720px;pointer-events:none;';
  document.body.appendChild(host);
  const frame = document.createElement('div');
  frame.className = `capturing relative h-[720px] w-[1280px] overflow-hidden bg-background text-foreground font-[family-name:var(--font-body)]${light ? ' slide-light' : ''}`;
  host.appendChild(frame);
  const root = createRoot(frame);
  const images = [];
  try {
    const bg = light ? '#ffffff' : `hsl(${getComputedStyle(frame).getPropertyValue('--background').trim()})`;
    for (let k = 0; k < slides.length; k++) {
      onProgress?.(k + 1, slides.length);
      flushSync(() => root.render(slides[k]));
      await wait(180); // let charts measure and lay out
      images.push(await toPng(frame, { pixelRatio: 2, backgroundColor: bg, cacheBust: true, width: 1280, height: 720 }));
    }
    const [{ default: pdfMake }, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
    const f = fonts.default ?? fonts;
    pdfMake.vfs = f?.pdfMake?.vfs ?? f?.vfs ?? f;
    const W = 960, H = 540; // 16:9 landscape page (points)
    const doc = {
      pageSize: { width: W, height: H }, pageOrientation: 'landscape', pageMargins: [0, 0, 0, 0],
      content: images.map((src, k) => ({ image: src, width: W, height: H, ...(k ? { pageBreak: 'before' } : {}) })),
    };
    await new Promise((resolve) => { pdfMake.createPdf(doc).download(fileName, resolve); setTimeout(resolve, 4000); });
  } finally {
    root.unmount();
    host.remove();
  }
}
