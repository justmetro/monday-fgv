import { findTerm } from '@generated/lib/competencias';
import { QUALI } from '@generated/lib/config';

// Pesos das dimensões (somam 100).
export const PESOS = { comp: 25, ativ: 25, areas: 15, fortes: 15, melhoria: 10, ints: 10 };
export const DIM_LABEL = { areas: 'Áreas de atuação', comp: 'Competências e habilidades', ativ: 'Atividades e entregas', fortes: 'Pontos fortes', melhoria: 'Pontos de melhoria', ints: 'Principais interesses' };
export const qualBand = (i) => (i >= 65 ? 'alta' : i >= 40 ? 'media' : 'baixa');
export const QUAL_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const QUADS = {
  indicar: { label: 'Indicar', order: 0, hint: 'Encaixa no papel e tem aderência' },
  potencial: { label: 'Potencial / exceção', order: 1, hint: 'Avaliar flexibilização' },
  verificar: { label: 'Verificar', order: 2, hint: 'Encaixa no papel, falta aderência' },
  descartar: { label: 'Descartar', order: 3, hint: 'Sem encaixe nem aderência' },
};

const nota = (ratio) => (ratio <= 0 ? 0 : ratio < 0.4 ? 1 : ratio < 0.8 ? 2 : 3);
const empty = (k, cross) => ({ k, nota: 1.5, empty: true, evid: null, cross });

// Weighted proportion of key competencies found; weak (generic) terms count as half evidence.
function propDim(k, found, targets, cross) {
  const tot = targets.reduce((s, x) => s + x.w, 0);
  if (!tot) return { k, nota: 1.5, empty: false, evid: 'sem competências-chave para cruzar', cross, hits: [] };
  let got = 0; const hits = [];
  targets.forEach((x) => { const h = found.get(x.c); if (h) { got += x.w * (h.weak ? QUALI.PESO_FRACO : 1); hits.push(x.c); } });
  const first = hits.length ? found.get(hits[0]) : null;
  return { k, nota: nota(got / tot), evid: first && first !== true ? first : null, cross, hits };
}

// Items (areas/interests, pre-normalized) vs eixo / projeto / cargo: none=0, partial=1, direct=2, direct in >1 target=3.
function matchTargets(k, items, eixoSet, targets, cross) {
  if (!items.length) return empty(k, cross);
  let direct = 0; let partial = false; let evid = null;
  const e = eixoSet ? items.find((x) => eixoSet.has(x.t)) : null;
  if (e) { direct += 1; evid = `${e.raw} ↔ eixo`; }
  targets.forEach(({ label, text }) => {
    if (!text) return;
    const hit = items.find((x) => x.t && text.includes(x.t));
    if (hit) { direct += 1; evid = evid ?? `${hit.raw} ↔ ${label}`; return; }
    const w = items.flatMap((x) => x.t.split(' ').filter((p) => p.length >= 4)).find((p) => text.includes(p));
    if (w) { partial = true; evid = evid ?? `“${w}” aparece em ${label}`; }
  });
  return { k, nota: direct >= 2 ? 3 : direct === 1 ? 2 : partial ? 1 : 0, evid, cross };
}

// Qualitative adherence for a perfil × vaga, using only cached features (pf, vf).
export function aderencia(pf, vf) {
  const key = vf.key;
  const essList = key.list.filter((x) => x.ess);
  const ess = essList.map((x) => x.c);
  const dims = [];

  dims.push(matchTargets('areas', pf.areas, vf.eixoAreas, vf.targets, 'Eixo, projeto e cargo'));

  const compCross = key.source === 'vaga' ? 'Essenciais (1) e desejáveis (0,5)' : 'Derivadas do eixo/cargo (0,5)';
  if (!pf.comps.size) dims.push(empty('comp', compCross));
  else {
    const m = new Map([...pf.comps].map((c) => [c, true]));
    const d = propDim('comp', m, key.list, compCross); d.evid = d.hits.length ? d.hits.join(', ') : null; dims.push(d);
  }

  const ativCross = vf.vagaAtiv ? 'Atribuições da vaga' : 'Competências da vaga + cargo';
  if (!pf.ativ) dims.push(empty('ativ', ativCross));
  else {
    const found = new Map(pf.ativ.found);
    const targets = [...key.list];
    if (vf.vagaAtiv) vf.vagaAtiv.forEach((_, c) => { if (!targets.some((x) => x.c === c)) targets.push({ c, w: 1, ess: false }); });
    if (vf.cargoWords.length) {
      const cf = findTerm(pf.ativ.nt, vf.cargoWords);
      if (cf) found.set('__cargo', { raw: pf.ativ.raw, ...cf, weak: false });
      targets.push({ c: '__cargo', w: 1, ess: false });
    }
    dims.push(propDim('ativ', found, targets, ativCross));
  }

  // Strengths cross with essentials (or all key competencies when none is essential).
  const fortesTargets = essList.length ? essList : key.list;
  if (!pf.fortes) dims.push(empty('fortes', essList.length ? 'Competências essenciais' : 'Competências-chave da vaga'));
  else dims.push(propDim('fortes', pf.fortes, fortesTargets, essList.length ? 'Competências essenciais' : 'Competências-chave da vaga'));

  // Gaps: strong, non-negated term only. Critical only when the essential comes from the vaga column.
  const mel = pf.mel;
  const strongMel = (c) => { const h = mel?.get(c); return h && !h.weak ? h : null; };
  const gaps = key.source === 'vaga' ? ess.filter(strongMel) : [];
  const possibleGaps = key.source === 'derivada' ? key.list.map((x) => x.c).filter(strongMel).map((c) => ({ c, ev: strongMel(c) })) : [];
  const toDevelop = key.list.filter((x) => !x.ess && key.source === 'vaga' && strongMel(x.c)).map((x) => x.c);
  if (!mel) dims.push(empty('melhoria', 'Essenciais (risco) e desejáveis'));
  else {
    const ev = gaps.length ? strongMel(gaps[0]) : possibleGaps[0]?.ev ?? (toDevelop.length ? strongMel(toDevelop[0]) : null);
    dims.push({ k: 'melhoria', nota: Math.max(0, 3 - gaps.length - 0.5 * possibleGaps.length), evid: ev, cross: 'Essenciais (risco) e desejáveis' });
  }

  dims.push(matchTargets('ints', pf.ints, vf.eixoInts, vf.targets, 'Eixo, projeto e cargo'));

  const index = Math.round(dims.reduce((s, d) => s + (d.nota / 3) * PESOS[d.k], 0) * 10) / 10;
  const dadosInsuf = pf.cover < QUALI.MIN_COBERTURA;
  return {
    index, band: qualBand(index), dims, source: key.source, gap: gaps.length > 0,
    cover: pf.cover, dadosInsuf, confiancaBaixa: vf.semInsumo,
    tags: {
      strong: ess.filter((c) => pf.fortes?.get(c) && !pf.fortes.get(c).weak),
      develop: toDevelop,
      gaps: gaps.map((c) => ({ c, ev: strongMel(c) })),
      possibleGaps,
      empty: dims.filter((d) => d.empty).map((d) => DIM_LABEL[d.k]),
      alerts: pf.alerts,
    },
  };
}

// Most restrictive rule wins: incompatible area → Descartar; partial area, critical gap or insufficient data → never Indicar.
export function quadrantOf(quant, qual, compat) {
  if (compat?.level === 0) return 'descartar';
  const qx = quant !== 'baixo', qy = qual.band !== 'baixa';
  if (qx && qy) return qual.gap || qual.dadosInsuf || compat?.level === 1 ? 'verificar' : 'indicar';
  if (qx) return 'verificar';
  return qy ? 'potencial' : 'descartar';
}

// Quadrant → qualitative index → viability score → urgency (desc) → name.
export const compareMatch = (a, b) => (QUADS[a.quad].order - QUADS[b.quad].order) || (b.qual.index - a.qual.index) || (b.total - a.total)
  || ((b.urgencia ?? 0) - (a.urgencia ?? 0)) || a.perfil.name.localeCompare(b.perfil.name, 'pt');
