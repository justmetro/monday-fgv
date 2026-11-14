import { toDate } from '@generated/lib/data';
import { normKey, clean } from '@generated/lib/normalize';
import { daysSince } from '@generated/lib/dates';

// ---- Esteira do perfil (ordem das etapas) — usada nos kanbans de perfis e de vagas ----
export const ESTEIRA_MAIN = [
  'Gatilho identificado', 'Perfil em mapeamento', 'Disponível para match', 'Em rodada de match', 'Em entrevista',
  'Aderência confirmada', 'Aceite confirmado', 'Em formalização (SupGP)', 'Aguardando mudança de residência', 'Realocado(a)',
];
export const ESTEIRA_END = ['Retido(a) na origem', 'Encaminhado(a) para desligamento', 'Desligado(a)'];
export const ESTEIRA = [...ESTEIRA_MAIN, ...ESTEIRA_END];
export const SEM_CANDIDATOS = 'Sem candidatos';
export const VAGA_ESTEIRA = [SEM_CANDIDATOS, ...ESTEIRA_MAIN];
const MAIN_IDX = new Map(ESTEIRA_MAIN.map((l, i) => [normKey(l), i]));

// A vaga sits at the most advanced stage reached by any of its candidates.
export function vagaEtapa(vaga, perfilById) {
  let best = -1;
  (vaga._matches ?? []).forEach((m) => (m._links ?? []).forEach((l) => {
    const i = MAIN_IDX.get(normKey(perfilById[l.id]?.statusDoPerfil));
    if (i != null && i > best) best = i;
  }));
  if (best >= 0) return ESTEIRA_MAIN[best];
  return vaga._matches?.length ? ESTEIRA_MAIN[3] : SEM_CANDIDATOS; // matches without linked profile → em rodada
}

// ---- Desalocação por data de disponibilidade (tolerância de 15 dias) ----
export const TOLERANCIA = 15;
export const SITU = {
  ocioso: 'Disponibilidade vencida — após tolerância',
  tolerancia: 'Disponibilidade vencida — em tolerância',
  ate15: 'A desalocar — até 15 dias',
  ate30: 'A desalocar — até 1 mês',
  ate60: 'A desalocar — até 2 meses',
  depois: 'A desalocar — mais de 2 meses',
};
export const SITU_ORDER = [SITU.ocioso, SITU.tolerancia, SITU.ate15, SITU.ate30, SITU.ate60, SITU.depois];
const ENCERRADO = new Set(['realocado(a)', 'desligado(a)', 'encaminhado(a) para desligamento', 'retido(a) na origem']);

// → null (sem data / processo encerrado) or { situ, days (desde a disponibilidade; negativo = futuro), ocioso, date }
export function desalocInfo(p) {
  if (!p || ENCERRADO.has(normKey(p.statusDoPerfil))) return null;
  const date = toDate(p.dataDeDisponibilidade);
  if (!date) return null;
  const n = daysSince(date);
  if (n > TOLERANCIA) return { situ: SITU.ocioso, days: n, ocioso: n - TOLERANCIA, date };
  if (n >= 0) return { situ: SITU.tolerancia, days: n, ocioso: 0, date };
  const u = -n;
  return { situ: u <= 15 ? SITU.ate15 : u <= 30 ? SITU.ate30 : u <= 60 ? SITU.ate60 : SITU.depois, days: n, ocioso: 0, date };
}
// Itens 3/10: função terminando (disponibilidade em até 15 dias) ou terminada, cruzada com o fim do TAP
// (Data de Saída no grupo Equipe dos quadros [PLAN]). Ociosa = TAP vigente; Em desalocação = TAP encerrado.
export const TAP = {
  ociosa: 'Ociosa', desaloc: 'Em desalocação', semFim: 'Sem fim do TAP no planejamento', fora: 'Não encontrada no planejamento',
  note: 'Função terminando ou terminada × fim do TAP (Data de Saída nos quadros [PLAN])',
};
export const TAP_ORDER = [TAP.ociosa, TAP.desaloc, TAP.semFim, TAP.fora];
export const TAP_PLACEHOLDERS = [];
export const TAP_JANELA = 15;
export function tapSituOf(p) {
  const info = desalocInfo(p);
  if (!info || info.days < -TAP_JANELA || !p?._tapOk) return null;
  if (!p._noPlan) return TAP.fora;
  const fim = toDate(p._fimTap);
  if (!fim) return TAP.semFim;
  return daysSince(fim) <= 0 ? TAP.ociosa : TAP.desaloc;
}
// Sem situação → motivo explícito (qual campo está vazio).
export const SEM_SITU = { semData: 'Sem informação — Data de Disponibilidade vazia', encerrado: 'Processo encerrado (fora da desalocação)' };
export const situacaoOf = (p) => desalocInfo(p)?.situ ?? (ENCERRADO.has(normKey(p?.statusDoPerfil)) ? SEM_SITU.encerrado : SEM_SITU.semData);
export const SITU_ORDER_ALL = [...SITU_ORDER, SEM_SITU.semData, SEM_SITU.encerrado];

// Prazo da vaga (regra do app): em aberto + Data de Início Prevista anterior a hoje → Atrasada;
// em aberto sem data → Sem data; demais → No prazo. Não usa mais a fórmula "Vaga atrasada" do quadro.
export function vagaPrazo(v) {
  const d = toDate(v?.dataDeIncioPrevista);
  if (!d) return 'Sem data';
  const open = String(v?.vagaEmAberto ?? '').trim() === '1';
  return open && daysSince(d) > 0 ? 'Atrasada' : 'No prazo';
}
export const isOcioso = (p) => desalocInfo(p)?.situ === SITU.ocioso;
export const isDesalocado = (p) => { const s = desalocInfo(p)?.situ; return s === SITU.ocioso || s === SITU.tolerancia; };
export const isADesalocar = (p) => [SITU.ate15, SITU.ate30, SITU.ate60].includes(desalocInfo(p)?.situ);

// ---- Vaga alocada (realocação ou contratação concluída) → sai das visualizações ----
const FORMA_ALOCADA = new Set(['realocacao interna', 'contratacao externa', 'progressao interna', 'indicacao']);
export function isVagaAlocada(v) {
  return normKey(v?.statusDaVaga) === 'preenchida' || !!toDate(v?.dataDePreenchimento) || FORMA_ALOCADA.has(normKey(clean(v?.formaDePreenchimento)));
}

// Match concluded (realocado/contratado) → offer to close the vaga.
const MATCH_CONCLUIDO = {
  statusDoMatch: new Set(['realocado(a)', 'formalizado(a)']),
  resultadoDaRodada: new Set(['realocado / formalizado', 'aprovado(a) e formalizado(a)', 'formalizado(a)']),
};
export const isConclusao = (key, value) => !!MATCH_CONCLUIDO[key]?.has(normKey(value));

export const vagaCodigo = (v) => (v?.id != null ? String(v.id) : null);
