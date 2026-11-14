import type { Range } from '@generated/components/painel/Fields';
import type { Decisao, Projeto } from '@generated/lib/painel';
import type { Simulacao } from '@generated/lib/extras';

export type Pessoa = { id: string; name: string };

export type DraftA = {
  status: string | null;
  alocacao: string | null;
  alerta: string | null;
  contratual: Range;
  ultimaEntrega: string | null;
};

export type DraftDecisao = {
  perspectiva: string | null;
  dataEntrada: string | null;
  decisao: string | null;
  meses: number | null;
  detalhe: string;
  responsaveis: Pessoa[];
};

/** Perspectiva de renovação/aditivo (guardada no app) em edição. */
export type DraftPersp = { tipo: string | null; nivel: string | null; temperatura: string | null; report: string };
/** Rascunho do projeto, compartilhado com a lista e os cards enquanto não for salvo. */
/** `cat`: Status de categorização; `base`: ids da Equipe base; `sim`: Realocar/Desligar/Manter por pessoa. */
export type Rascunho = { a?: DraftA; d?: DraftDecisao; p?: DraftPersp; cat?: string | null; base?: string[]; sim?: Simulacao };

export function draftPerspFrom(x: { tipo?: string | null; nivel?: string | null; temperatura?: string | null; report?: string } | undefined): DraftPersp {
  return { tipo: x?.tipo ?? null, nivel: x?.nivel ?? null, temperatura: x?.temperatura ?? null, report: x?.report ?? '' };
}
export const perspNorm = (p: DraftPersp): DraftPersp => ({ ...p, report: p.report.trim() });

export function draftAFrom(p: Projeto): DraftA {
  return {
    status: p.status,
    alocacao: p.alocacao,
    alerta: p.alertaDesalocacao,
    contratual: p.contratual,
    ultimaEntrega: p.ultimaEntrega,
  };
}
export function draftDecisaoFrom(d: Decisao | undefined): DraftDecisao {
  return {
    perspectiva: d?.perspectiva ?? null,
    dataEntrada: d?.dataEntrada ?? null,
    decisao: d?.decisao ?? null,
    meses: d?.mesesManutencao ?? null,
    detalhe: d?.detalhe ?? '',
    responsaveis: d?.responsaveis ?? [],
  };
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function rangeWrite(r: Range): { from: string; to: string } | null {
  if (!r || (!r.from && !r.to)) return null;
  return { from: r.from ?? r.to ?? '', to: r.to ?? r.from ?? '' };
}
export function rangeIncompleto(r: Range): boolean {
  return !!r && (!!r.from !== !!r.to);
}
