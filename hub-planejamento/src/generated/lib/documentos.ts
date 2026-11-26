// Extração do texto dos documentos no navegador (PDF com pdf.js, DOCX com mammoth, TXT direto).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const TIPOS_DOC = ['TR', 'Contrato', 'Termo Aditivo', 'Proposta', 'ETP', 'Minuta de escopo', 'Orçamento', 'Anexo', 'Pasta de Negócios', 'Outro'] as const;

export interface DocLocal {
  chave: string; arquivo: File; nome: string; tipo: string;
  estado: 'lendo' | 'ok' | 'erro'; texto: string; paginas: number; erro?: string; semTexto?: boolean;
}

export function adivinharTipo(nome: string): string {
  const n = nome.toLowerCase();
  if (/\btr\b|termo.?de.?refer/.test(n)) return 'TR';
  if (/aditivo/.test(n)) return 'Termo Aditivo';
  if (/contrato|termo.?de.?colabora|conv[eê]nio/.test(n)) return 'Contrato';
  if (/proposta/.test(n)) return 'Proposta';
  if (/\betp\b|estudo.?t[eé]cnico/.test(n)) return 'ETP';
  if (/minuta/.test(n)) return 'Minuta de escopo';
  if (/or[cç]amento|planilha/.test(n)) return 'Orçamento';
  if (/anexo/.test(n)) return 'Anexo';
  return 'Outro';
}

async function textoPdf(buf: ArrayBuffer): Promise<{ texto: string; paginas: number }> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const partes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let linha = '';
    let ultimoY: number | null = null;
    const linhas: string[] = [];
    for (const it of tc.items as any[]) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform?.[5] ?? 0);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 3) { linhas.push(linha.trim()); linha = ''; }
      linha += (linha && !linha.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      ultimoY = y;
      if (it.hasEOL) { linhas.push(linha.trim()); linha = ''; ultimoY = null; }
    }
    if (linha.trim()) linhas.push(linha.trim());
    partes.push(`[página ${p}]\n${linhas.filter(Boolean).join('\n')}`);
    page.cleanup();
  }
  await pdf.destroy();
  return { texto: partes.join('\n\n'), paginas: pdf.numPages };
}

async function textoDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth: any = await import('mammoth/mammoth.browser');
  const r = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buf });
  return String(r.value ?? '');
}

export async function lerArquivo(f: File): Promise<{ texto: string; paginas: number }> {
  const buf = await f.arrayBuffer();
  const n = f.name.toLowerCase();
  if (n.endsWith('.pdf')) return textoPdf(buf);
  if (n.endsWith('.docx')) return { texto: await textoDocx(buf), paginas: 0 };
  if (n.endsWith('.txt') || n.endsWith('.md')) return { texto: new TextDecoder().decode(buf), paginas: 0 };
  throw new Error('Formato não suportado. Envie PDF, DOCX ou TXT.');
}

export function paraBase64(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => falha(r.error);
    r.readAsDataURL(f);
  });
}
