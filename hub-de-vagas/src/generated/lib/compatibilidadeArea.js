// ============================================================================
// COMPATIBILIDADE DE ÁREA — limiares editáveis
// ============================================================================
export const LIMIAR_MIN = 0.5; // score mínimo para ser família principal
export const LIMIAR_REL = 0.6; // ...e ≥ 60% do maior score
export const MAX_FAMILIAS = 2; // no máximo 2 famílias principais
export const LIMIAR_FORTE = 1.0; // inferência forte = maior score ≥ 1,0 E hit de texto numa família principal
export const PESO_TEXTO = 1.0; // peso do sinal de texto (hit por família)
export const GENERALISTA_AREAS = 6; // ≥ 6 áreas sem família principal → generalista
export const MAX_EXPLICITAS = 2; // aviso no diagnóstico acima disso

// Como editar: FAMILIAS (nomes), AREAS_PERFIL (dropdown do perfil → famílias),
// EIXOS_VAGA (eixo da vaga → famílias), PALAVRAS (trechos sem acento no Papel de
// Origem / título+cargo da vaga → família) e PARES (2 compatível, 1 parcial, 0 incompatível).
export const FAMILIAS = {
  planejamento: 'Planejamento / Gestão de Projetos / PMO',
  dados: 'Dados / Analytics / BI / Estatística',
  academico: 'Acadêmico / Pedagógico / Pesquisa / Ensino',
  comunicacao: 'Comunicação / Conteúdo / Design',
  articulacao: 'Articulação / Relacionamento Institucional',
  admin: 'Administrativo / Financeiro / RH / Jurídico',
  economia: 'Economia / Setor Público',
  ti: 'TI / Tecnologia',
};

export const AREAS_PERFIL = {
  'gestao de projetos': ['planejamento'], 'planejamento estrategico': ['planejamento'], operacional: ['planejamento', 'admin'],
  'lideranca de times': ['planejamento'], pedagogico: ['academico'], 'formacao de educadores': ['academico'], tutoria: ['academico'],
  'conteudo autoria': ['comunicacao', 'academico'], dados: ['dados'], 'monitoramento e avaliacao': ['dados'], design: ['comunicacao'],
  comunicacao: ['comunicacao'], 'articulacao relac institucional': ['articulacao'], 'relacionamento institucional': ['articulacao'],
  'economia e setor publico': ['economia'], juridico: ['admin'], 'recursos humanos': ['admin'],
};

export const EIXOS_VAGA = {
  ept: ['academico'], 'gestao para a aprendizagem': ['academico', 'planejamento'], 'gestao estrategica': ['planejamento', 'economia'],
  'gestao do projeto': ['planejamento'], 'avaliacao e dados': ['dados'], formacao: ['academico'], 'formacao de educadores': ['academico'],
  'planejamento estrategico': ['planejamento'], 'editorial conteudo': ['comunicacao', 'academico'], 'gestao das regionais': ['articulacao', 'planejamento'],
  'progressao parcial': ['academico'], 'corporativo areas meio': ['admin', 'comunicacao'], 'gestao curricular': ['academico'],
  'acesso e permanencia': ['academico', 'articulacao'], 'desenvolvimento institucional': ['articulacao', 'economia', 'planejamento'],
};

export const PALAVRAS = [
  ['dados', 'dados'], ['analytics', 'dados'], [' bi ', 'dados'], ['estatist', 'dados'], ['cientista', 'dados'], ['monitoramento', 'dados'], ['avaliacao de impacto', 'dados'],
  ['pesquis', 'academico'], ['academ', 'academico'], ['professor', 'academico'], ['pedagog', 'academico'], ['formador', 'academico'], ['formacao', 'academico'],
  ['tutor', 'academico'], ['curricul', 'academico'], ['alfabetiz', 'academico'], ['ensino', 'academico'], ['orientador', 'academico'], ['educacion', 'academico'],
  ['planejamento', 'planejamento'], ['pmo', 'planejamento'], ['estrateg', 'planejamento'],
  ['comunica', 'comunicacao'], ['conteud', 'comunicacao'], ['editor', 'comunicacao'], ['revisor', 'comunicacao'], ['design', 'comunicacao'], ['diagram', 'comunicacao'],
  ['articula', 'articulacao'], ['articulador', 'articulacao'], ['regional', 'articulacao'], ['institucional', 'articulacao'], ['relacionamento', 'articulacao'], ['mobiliza', 'articulacao'], ['engajamento', 'articulacao'],
  ['jurid', 'admin'], ['recursos humanos', 'admin'], [' rh ', 'admin'], ['financ', 'admin'], ['administr', 'admin'], ['contab', 'admin'],
  ['economi', 'economia'], ['politica publica', 'economia'], ['setor publico', 'economia'], ['orcament', 'economia'],
  [' ti ', 'ti'], ['tecnologia', 'ti'], ['desenvolvedor', 'ti'], ['software', 'ti'],
];

export const PADRAO = 1;
export const PARES = [
  ['planejamento', 'dados', 1], ['planejamento', 'academico', 1], ['planejamento', 'comunicacao', 1], ['planejamento', 'articulacao', 2],
  ['planejamento', 'admin', 1], ['planejamento', 'economia', 2], ['planejamento', 'ti', 1],
  ['dados', 'academico', 0], ['dados', 'comunicacao', 0], ['dados', 'articulacao', 0], ['dados', 'admin', 1], ['dados', 'economia', 2], ['dados', 'ti', 2],
  ['academico', 'comunicacao', 2], ['academico', 'articulacao', 1], ['academico', 'admin', 0], ['academico', 'economia', 1], ['academico', 'ti', 0],
  ['comunicacao', 'articulacao', 1], ['comunicacao', 'admin', 1], ['comunicacao', 'economia', 0], ['comunicacao', 'ti', 1],
  ['articulacao', 'admin', 1], ['articulacao', 'economia', 2], ['articulacao', 'ti', 0],
  ['admin', 'economia', 1], ['admin', 'ti', 1], ['economia', 'ti', 1],
];
// ============================================================================

const n = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LEVEL = new Map();
PARES.forEach(([a, b, l]) => { LEVEL.set(`${a}|${b}`, l); LEVEL.set(`${b}|${a}`, l); });
export const levelOf = (a, b) => (a === b ? 2 : LEVEL.get(`${a}|${b}`) ?? PADRAO);
export const COMPAT_LABEL = { 2: 'Compatível', 1: 'Área parcial', 0: 'Incompatível', none: 'Área sem informação', generalista: 'Generalista (áreas muito amplas)', possivel: 'Possível incompatibilidade (área inferida)' };

export const FAMILIA_COL = { id: 'dropdown_mm8k8yge', title: 'Família de área', prop: 'famliaDeRea' };
export const LABEL_FAMILIA = { planejamento: 'Planejamento', dados: 'Dados', academico: 'Acadêmico', comunicacao: 'Comunicação', articulacao: 'Articulação', economia: 'Economia', admin: 'Administrativo', ti: 'TI' };
const FAMILIA_BY_LABEL = Object.fromEntries(Object.entries(LABEL_FAMILIA).map(([k, l]) => [n(l), k]));

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => typeof x === 'string' && x.trim());
// Job title after "|" in the vaga name ("GA BA | Consultor(a) de Tratamento" → "Consultor(a) de Tratamento").
export const tituloVaga = (name) => { const s = String(name ?? ''); const i = s.indexOf('|'); return i >= 0 ? s.slice(i + 1).trim() : ''; };
export const vagaTexto = (v) => [tituloVaga(v.name), v.cargoPapel].filter((x) => typeof x === 'string' && x.trim()).join(' · ');

// → { fams, source: 'explicita'|'inferida'|null, kind: 'generalista'|'sem'|null, strong, top, scores, triggers, onlyWords, motivo, nAreas }
function resolve(explicit, drop, shareOf, dropdownLabel, text, textLabel) {
  const ex = [...new Set(arr(explicit).map((l) => FAMILIA_BY_LABEL[n(l)]).filter(Boolean))];
  if (ex.length) return { fams: ex, source: 'explicita', kind: null, strong: true, top: Infinity, scores: {}, triggers: [], onlyWords: false, motivo: null, nAreas: drop.length };
  const share = shareOf(drop);
  const t = ` ${n(text)} `;
  const triggers = [];
  const hit = {};
  PALAVRAS.forEach(([w, f]) => { if (t.includes(w)) { triggers.push({ fam: f, via: 'palavra', term: w.trim() }); hit[f] = 1; } });
  Object.entries(share.triggers).forEach(([f, terms]) => terms.forEach((term) => triggers.push({ fam: f, via: 'dropdown', term })));
  const scores = {};
  new Set([...Object.keys(share.s), ...Object.keys(hit)]).forEach((f) => { scores[f] = (share.s[f] ?? 0) + PESO_TEXTO * (hit[f] ?? 0); });
  const top = Math.max(0, ...Object.values(scores));
  const fams = Object.entries(scores).filter(([, s]) => s >= LIMIAR_MIN && s >= LIMIAR_REL * top).sort((a, b) => b[1] - a[1]).slice(0, MAX_FAMILIAS).map(([f]) => f);
  if (fams.length) {
    return { fams, source: 'inferida', kind: null, strong: top >= LIMIAR_FORTE && fams.some((f) => hit[f]), top, scores, triggers: triggers.filter((x) => fams.includes(x.fam)), onlyWords: fams.every((f) => !(share.s[f] > 0)), motivo: null, nAreas: drop.length };
  }
  if (drop.length >= GENERALISTA_AREAS) return { fams: [], source: null, kind: 'generalista', strong: false, top, scores, triggers: [], onlyWords: false, motivo: `${drop.length} áreas selecionadas, nenhuma família predominante`, nAreas: drop.length };
  const outras = drop.some((a) => ['outras', 'outros', 'outro'].includes(n(a)));
  const motivo = !drop.length && !String(text ?? '').trim() ? 'Campo vazio'
    : outras && !Object.keys(share.s).length ? `Família 'Outras' em ${dropdownLabel}`
    : top > 0 ? 'Sinais fracos (abaixo do limiar)'
    : String(text ?? '').trim() ? `${textLabel} sem palavra-chave reconhecida` : `${dropdownLabel} sem família mapeada`;
  return { fams: [], source: null, kind: 'sem', strong: false, top, scores, triggers: [], onlyWords: false, motivo, nAreas: drop.length };
}

// Perfil: share[f] = áreas mapeadas para f / total de áreas selecionadas.
const perfilShare = (drop) => {
  const s = {}; const triggers = {};
  drop.forEach((a) => (AREAS_PERFIL[n(a)] ?? []).forEach((f) => { s[f] = (s[f] ?? 0) + 1 / drop.length; (triggers[f] ??= []).push(a); }));
  return { s, triggers };
};
// Vaga: o Eixo conta como 1 seleção distribuída igualmente entre suas famílias.
const vagaShare = (drop) => {
  const s = {}; const triggers = {};
  drop.forEach((e) => { const fs = EIXOS_VAGA[n(e)] ?? []; fs.forEach((f) => { s[f] = (s[f] ?? 0) + 1 / fs.length / drop.length; (triggers[f] ??= []).push(e); }); });
  return { s, triggers };
};

export const perfilArea = (p) => resolve(p.famliaDeRea, arr(p.perfilReasDeAtuao), perfilShare, 'Áreas de atuação', p.papelDeOrigem, 'Papel');
export const vagaArea = (v) => resolve(v.famliaDeRea, arr(v.eixoDeAtuao), vagaShare, 'Eixo', vagaTexto(v), 'Título/cargo');
export const familiaLabels = (fams) => fams.map((f) => LABEL_FAMILIA[f]).filter(Boolean);
const famTxt = (l) => l.map((f) => FAMILIAS[f]).join(', ');

// pa/va = resolved areas (cached by the caller). → { level, semInfo, generalista, possivelIncompat, motivo, ... }
export function compatibilidadeFrom(p, v, pa, va) {
  const base = { perfilId: p.id, vagaId: v.id, perfilName: p.name, vagaName: v.name, perfil: pa.fams, vaga: va.fams, pSource: pa.source, vSource: va.source, inferida: pa.source === 'inferida' || va.source === 'inferida', semInfo: false, generalista: false, possivelIncompat: false };
  if (pa.kind === 'generalista' || va.kind === 'generalista') {
    return { ...base, level: 1, generalista: true, motivo: `${pa.kind === 'generalista' ? 'Perfil' : 'Vaga'} generalista (${(pa.kind === 'generalista' ? pa : va).motivo}) — tratado como parcial` };
  }
  if (!pa.fams.length || !va.fams.length) {
    return { ...base, level: 1, semInfo: true, motivo: !pa.fams.length ? `Perfil sem área (${pa.motivo}) — tratado como parcial` : `Vaga sem área (${va.motivo}) — tratada como parcial` };
  }
  let best = { l: -1, a: null, b: null };
  pa.fams.forEach((a) => va.fams.forEach((b) => { const l = levelOf(a, b); if (l > best.l) best = { l, a, b }; }));
  if (best.l === 0) {
    // Incompatible only when both sides are firm (explicit column or strong inference); otherwise capped at Parcial.
    const firm = (x) => x.source === 'explicita' || x.strong;
    if (firm(pa) && firm(va)) return { ...base, level: 0, motivo: `Área de origem: ${famTxt(pa.fams)} × vaga: ${famTxt(va.fams)}` };
    return { ...base, level: 1, possivelIncompat: true, motivo: `Possível incompatibilidade (${famTxt(pa.fams)} × ${famTxt(va.fams)}), mas a área é inferida com sinal fraco — tratado como parcial` };
  }
  return { ...base, level: best.l, motivo: `${FAMILIAS[best.a]} ↔ ${FAMILIAS[best.b]} = ${best.l === 2 ? 'compatível' : 'parcial'}` };
}
export const compatibilidade = (p, v) => compatibilidadeFrom(p, v, perfilArea(p), vagaArea(v));
