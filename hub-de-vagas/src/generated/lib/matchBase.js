import { normKey, clean } from '@generated/lib/normalize';

// ---- Normalização ------------------------------------------------------------
export const nv = (s) => normKey(clean(s) ?? '').replace(/\bhibrida\b/g, 'hibrido').replace(/\bbolsista\b/g, 'bolsa');
export const list = (v) => { const c = clean(v); return Array.isArray(c) ? c : c ? [c] : []; };

// ---- UFs ---------------------------------------------------------------------
const STATES = {
  AC: 'acre', AL: 'alagoas', AP: 'amapa', AM: 'amazonas', BA: 'bahia', CE: 'ceara', DF: 'distrito federal', ES: 'espirito santo', GO: 'goias',
  MA: 'maranhao', MT: 'mato grosso', MS: 'mato grosso do sul', MG: 'minas gerais', PA: 'para', PB: 'paraiba', PR: 'parana', PE: 'pernambuco', PI: 'piaui',
  RJ: 'rio de janeiro', RN: 'rio grande do norte', RS: 'rio grande do sul', RO: 'rondonia', RR: 'roraima', SC: 'santa catarina', SP: 'sao paulo', SE: 'sergipe', TO: 'tocantins',
};
const BY_NAME = Object.fromEntries(Object.entries(STATES).map(([uf, n]) => [n, uf]));
export function parseUFs(values) {
  const out = new Set();
  list(values).forEach((entry) => String(entry).split(/[;,/]/).forEach((tok) => {
    const t = tok.trim();
    const paren = t.match(/\(([A-Za-z]{2})\)/);
    if (paren && STATES[paren[1].toUpperCase()]) { out.add(paren[1].toUpperCase()); return; }
    if (/^[A-Za-z]{2}$/.test(t) && STATES[t.toUpperCase()]) { out.add(t.toUpperCase()); return; }
    const uf = BY_NAME[normKey(t)];
    if (uf) out.add(uf);
  }));
  return out;
}

// ---- Senioridade -------------------------------------------------------------
const LEVELS = {
  'junior 1': 1, 'junior 2': 2, 'junior 3': 3, 'junior 2 ou 3': 2.5, 'pleno 1': 4, 'pleno 2': 5, 'pleno 3': 6,
  'senior 1': 7, 'senior 2': 8, 'senior 3': 9, 'senior 4': 10, especialista: 10,
  'coordenador(a) de area': 11, 'coordenador de area': 11, 'gerente de projetos': 12,
};
for (let i = 1; i <= 7; i += 1) LEVELS[`gerente ${i}`] = 12;
export const level = (s) => LEVELS[nv(s)] ?? null;

// ---- Eixo → áreas / interesses ----------------------------------------------
const EIXOS = {
  ept: { areas: ['Pedagógico', 'Formação de Educadores'], ints: ['EPT', 'Educação Profissional Tecnológica (EPT)'] },
  'gestao para a aprendizagem': { areas: ['Pedagógico', 'Formação de Educadores', 'Gestão de Projetos'], ints: ['Gestão da Aprendizagem'] },
  'gestao estrategica': { areas: ['Planejamento Estratégico', 'Gestão de Projetos', 'Economia e Setor Público'], ints: ['Gestão Estratégica'] },
  'gestao do projeto': { areas: ['Gestão de Projetos', 'Operacional', 'Planejamento Estratégico'], ints: ['Gestão Estratégica'] },
  'avaliacao e dados': { areas: ['Dados', 'Monitoramento e Avaliação'], ints: ['Dados', 'Pesquisa e estudo'] },
  formacao: { areas: ['Formação de Educadores', 'Pedagógico', 'Tutoria'], ints: ['Formação'] },
  'editorial/conteudo': { areas: ['Conteúdo / Autoria', 'Design', 'Comunicação', 'Pedagógico'], ints: [] },
  'gestao das regionais': { areas: ['Articulação / Relac. Institucional', 'Relacionamento Institucional', 'Operacional', 'Pedagógico', 'Liderança de Times'], ints: ['Articulação Institucional'] },
  'corporativo / areas-meio': { areas: ['Operacional', 'Recursos Humanos', 'Jurídico', 'Comunicação'], ints: [] },
  'desenvolvimento institucional': { areas: ['Articulação / Relac. Institucional', 'Relacionamento Institucional', 'Economia e Setor Público', 'Planejamento Estratégico'], ints: ['Articulação Institucional'] },
};
EIXOS['planejamento estrategico'] = EIXOS['gestao estrategica'];
EIXOS['formacao de educadores'] = EIXOS.formacao;
// Raw labels; normalized by the caller with the same collapse used for perfil items.
export const EIXO_MAP = EIXOS;

const GUESS = [[/dados/, 'avaliacao e dados'], [/formac|formador|tutor/, 'formacao'], [/articulador|regional/, 'gestao das regionais'], [/conteud|editor|revisor|diagram/, 'editorial/conteudo'], [/planejamento/, 'planejamento estrategico'], [/gestao/, 'gestao do projeto']];
export function eixoOf(vaga, cargoText) {
  const e = nv(vaga.eixoDeAtuao);
  if (e && EIXOS[e]) return { key: e, guessed: false };
  if (e) return { key: null, guessed: false };
  const hit = GUESS.find(([re]) => re.test(nv(cargoText ?? vaga.cargoPapel)));
  return { key: hit ? hit[1] : null, guessed: !!hit };
}

// ---- Palavras ----------------------------------------------------------------
const STOP = new Set(['consultor', 'consultora', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);
export const words = (s) => nv(s).replace(/\(a\)/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
