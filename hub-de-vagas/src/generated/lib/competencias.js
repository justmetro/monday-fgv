import { clean } from '@generated/lib/normalize';
import { QUALI } from '@generated/lib/config';

// ============================================================================
// CONFIG EDITÁVEL — sinônimos por competência (FORTES contam 1; FRACOS contam
// meia evidência e nunca geram gap), alertas das Observações e competências
// derivadas do eixo/cargo. Termos sem acento e em minúsculas.
// ============================================================================
export const SINONIMOS = {
  'Comunicação e escuta ativa': { forte: ['comunica', 'escuta', 'assertiv', 'apresenta', 'oratoria', 'escrita', 'interlocu'], fraco: [] },
  'Visão estratégica': { forte: ['estrateg', 'visao', 'contexto macro', 'antecip'], fraco: [] },
  'Visão sistêmica': { forte: ['sistemic', 'visao do todo', 'integrad'], fraco: [] },
  'Gerenciamento de riscos': { forte: ['risco', 'cenario'], fraco: [] },
  'Priorização': { forte: ['prioriz', 'gestao do tempo', 'celeridade', 'cronograma'], fraco: ['prazo', 'multiplas entregas'] },
  'Autonomia': { forte: ['autonom', 'proativ', 'iniciativa', 'direcionamento', 'protagonismo'], fraco: [] },
  'Delegação': { forte: ['deleg', 'distribu', 'centraliz'], fraco: [] },
  'Desenvolvimento de pessoas': { forte: ['lideran', 'conduzir equipe', 'mobilizar a equipe'], fraco: ['coordena'] },
  'Inteligência emocional': { forte: ['inteligencia emocional', 'pressao', 'emocional', 'timidez', 'conflito'], fraco: [] },
  'Fortalecimento de relacionamentos': { forte: ['relacionamento', 'stakeholder', 'partes interessadas', 'articula'], fraco: [] },
  'Negociação': { forte: ['negocia', 'alinhamento de expectativa', 'cobranca'], fraco: [] },
  'Conhecimento técnico': { forte: ['tecnic', 'metodolog', 'juridic'], fraco: ['conhecimento', 'dados', 'planilha', 'analise'] },
  'Entrega com qualidade': { forte: ['qualidade', 'detalhe', 'cuidado', 'diagrama', 'visual'], fraco: [] },
  'Monitoramento de resultados': { forte: ['monitora', 'acompanha', 'indicador'], fraco: ['resultado'] },
  'Adaptabilidade': { forte: ['adapta', 'flexib', 'mudanca', 'fora do planejamento'], fraco: [] },
  'Trabalho colaborativo': { forte: ['colabora'], fraco: ['equipe', 'coletivo'] },
  'Foco em resultado': { forte: ['foco no resultado', 'foco em resultado'], fraco: ['entrega'] },
  'Respeito e empatia': { forte: ['empat', 'respeit', 'acolh'], fraco: [] },
  'Aprimoramento contínuo': { forte: ['aprimora', 'aprendiz', 'melhoria continua', 'estud'], fraco: [] },
};
export const ALERTAS = ['restric', 'restri', 'saida', 'sair', 'licenc', 'afastament', 'preferen', 'prefere', 'nao quer', 'nao deseja', 'mudanca', 'condicion', 'gestante', 'maternidade', 'pendenc', 'desligament'];

// Negação/ressalva nos ~40 caracteres anteriores (mesma frase).
export const NEGACAO = ['nao ', 'sem ', 'nunca', 'nenhum', 'ausencia'];
export const RESSALVA_MELHORIA = ['domina', 'excelente', 'muito bom', 'boa ', 'bom '];

// Só as 14 opções que o dropdown de competências da VAGA oferece.
const DERIVADAS = {
  lead: ['Desenvolvimento de pessoas', 'Visão estratégica', 'Priorização'],
  data: ['Conhecimento técnico', 'Monitoramento de resultados', 'Entrega com qualidade'],
  rel: ['Comunicação e escuta ativa', 'Trabalho colaborativo', 'Adaptabilidade'],
  form: ['Comunicação e escuta ativa', 'Desenvolvimento de pessoas', 'Conhecimento técnico'],
  gest: ['Visão estratégica', 'Gerenciamento de riscos', 'Monitoramento de resultados', 'Priorização'],
  edit: ['Entrega com qualidade', 'Conhecimento técnico', 'Autonomia'],
  ept: ['Conhecimento técnico', 'Visão sistêmica', 'Trabalho colaborativo'],
  corp: ['Entrega com qualidade', 'Priorização', 'Autonomia'],
};
// ============================================================================

// Length-preserving normalization (lowercase, no accents, no punctuation) so indices map back to the original text.
export function normText(s) {
  return [...String(s ?? '')].map((c) => { const b = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return /[a-z0-9]/.test(b[0] ?? '') ? b[0] : ' '; }).join('');
}
export const nn = (s) => normText(s).replace(/\s+/g, ' ').trim();

const CANON = Object.fromEntries(Object.keys(SINONIMOS).map((k) => [nn(k), k]));
CANON[nn('Delegação de Atividades')] = 'Delegação';
export const canonComp = (s) => CANON[nn(s)] ?? String(s).trim();

export function snippet(original, idx, len) {
  const s = String(original);
  const a = Math.max(0, idx - 50), b = Math.min(s.length, idx + len + 70);
  return `${a > 0 ? '…' : ''}${s.slice(a, b).replace(/\s+/g, ' ').trim()}${b < s.length ? '…' : ''}`;
}
// Evidence is stored as { raw, idx, len } (no string copies); text is built only when shown.
export const evText = (e) => (e == null ? null : typeof e === 'string' ? e : snippet(e.raw, e.idx, e.len));

// First occurrence of any term → { idx, len } or null.
export function findTerm(nt, terms) {
  let best = null;
  terms.forEach((t) => { const i = nt.indexOf(t); if (i >= 0 && (!best || i < best.idx)) best = { idx: i, len: t.length }; });
  return best;
}

// Window before idx limited to the same sentence of the raw text.
function before(raw, nt, idx) {
  let a = Math.max(0, idx - QUALI.JANELA_NEGACAO);
  const seg = raw.slice(a, idx);
  const cut = Math.max(seg.lastIndexOf('.'), seg.lastIndexOf(';'), seg.lastIndexOf('!'), seg.lastIndexOf('?'), seg.lastIndexOf('\n'));
  if (cut >= 0) a += cut + 1;
  return `${nt.slice(a, idx)}`;
}
function firstValid(raw, nt, terms, blockers) {
  let best = null;
  terms.forEach((t) => {
    let i = nt.indexOf(t);
    while (i >= 0) {
      const w = blockers.length ? ` ${before(raw, nt, i)}` : '';
      if (!blockers.some((b) => w.includes(b))) { if (!best || i < best.idx) best = { idx: i, len: t.length }; break; }
      i = nt.indexOf(t, i + t.length);
    }
  });
  return best;
}

// Competencies detected in a free text → Map(comp → { raw, idx, len, weak }).
// mode: 'plain' (no negation) | 'fortes' (negation) | 'melhoria' (negation + ressalva).
export function detect(text, mode = 'plain') {
  const m = new Map();
  const raw = clean(text);
  if (!raw || typeof raw !== 'string') return m;
  const nt = normText(raw);
  const blockers = mode === 'melhoria' ? [...NEGACAO, ...RESSALVA_MELHORIA] : mode === 'fortes' ? NEGACAO : [];
  Object.entries(SINONIMOS).forEach(([c, { forte, fraco }]) => {
    const f = firstValid(raw, nt, forte, blockers);
    if (f) { m.set(c, { raw, ...f, weak: false }); return; }
    const w = fraco.length ? firstValid(raw, nt, fraco, blockers) : null;
    if (w) m.set(c, { raw, ...w, weak: true });
  });
  return m;
}
export function alerts(text) {
  const raw = clean(text);
  if (!raw || typeof raw !== 'string') return [];
  const nt = normText(raw);
  const out = []; const seen = new Set();
  ALERTAS.forEach((t) => { let i = nt.indexOf(t); while (i >= 0 && out.length < 4) { const sn = snippet(raw, i, t.length); if (![...seen].some((s) => Math.abs(s - i) < 60)) { out.push(sn); seen.add(i); } i = nt.indexOf(t, i + t.length); } });
  return out;
}

// Key competencies for a vaga → { list: [{ c, w, ess }], source: 'vaga' | 'derivada' }
export function vagaCompetencias(v, cargoText) {
  const arr = (x) => { const c = clean(x); return Array.isArray(c) ? c : c ? [c] : []; };
  const ess = arr(v.competnciasEssenciais).map(canonComp);
  const des = arr(v.competnciasDesejveis).map(canonComp);
  if (ess.length || des.length) {
    const m = new Map();
    ess.forEach((c) => m.set(c, 1));
    des.forEach((c) => { if (!m.has(c)) m.set(c, 0.5); });
    return { list: [...m].map(([c, w]) => ({ c, w, ess: w === 1 })), source: 'vaga' };
  }
  const e = nn(clean(v.eixoDeAtuao)), cargo = nn(cargoText ?? clean(v.cargoPapel));
  const set = new Set();
  const add = (l) => l.forEach((c) => set.add(c));
  if (/lider|coordenador|gerente|coordenacao/.test(cargo)) add(DERIVADAS.lead);
  if (e === 'avaliacao e dados' || /dados|monitoramento/.test(cargo)) add(DERIVADAS.data);
  if (['gestao das regionais', 'desenvolvimento institucional'].includes(e) || /articulador|regional|mobilizacao|engajamento/.test(cargo)) add(DERIVADAS.rel);
  if (['formacao', 'formacao de educadores'].includes(e) || /formador|tutor|orientador/.test(cargo)) add(DERIVADAS.form);
  if (['gestao do projeto', 'gestao estrategica', 'planejamento estrategico', 'gestao para a aprendizagem'].includes(e)) add(DERIVADAS.gest);
  if (e === 'editorial conteudo' || /conteud|editor|revisor|diagram/.test(cargo)) add(DERIVADAS.edit);
  if (e === 'ept') add(DERIVADAS.ept);
  if (e === 'corporativo areas meio') add(DERIVADAS.corp);
  // Derived competencies are NOT essential and weigh 0.5.
  return { list: [...set].map((c) => ({ c, w: QUALI.PESO_DERIVADA, ess: false })), source: 'derivada' };
}
