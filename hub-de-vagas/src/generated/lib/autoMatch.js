import { toDate } from '@generated/lib/data';
import { clean } from '@generated/lib/normalize';
import { daysSince } from '@generated/lib/dates';
import { compatibilidadeFrom } from '@generated/lib/compatibilidadeArea';
import { aderencia, quadrantOf, compareMatch } from '@generated/lib/aderencia';
import { perfilF, vagaF } from '@generated/lib/features';
import { nv, level, words, parseUFs } from '@generated/lib/matchBase';
import { VIAB, MAX_RODADA } from '@generated/lib/config';

export { nv, level, words, parseUFs };

export const PERFIL_STATUS_OK = ['Gatilho identificado', 'Perfil em mapeamento', 'Disponivel para match', 'Em rodada de match'].map(nv);
export const VAGA_STATUS_OK = ['Aprovada - em aberto', 'Priorizada para realocação', 'Em rodada de match'].map(nv);

// ---- Datas -------------------------------------------------------------------
export const monthKeyOf = (d) => { const dt = toDate(d); return dt ? `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}` : null; };
const monthEnd = (key) => { const [y, m] = key.split('-').map(Number); return Date.UTC(y, m, 0); };
export const monthStartISO = (key) => `${key}-01`;

// ---- Filtros eliminatórios (inalterados; leem features em cache) ------------
export function eliminates(p, v, monthKey) {
  const pf = perfilF(p), vf = vagaF(v);
  if (pf.disp == null || pf.disp > monthEnd(monthKey)) return 'mes';
  if (pf.vin && vf.mod && pf.vin !== vf.mod) return 'vinculo';
  if (pf.level != null && vf.level != null && vf.level < pf.level) return 'senioridade'; // never reduce seniority; going up is unlimited
  if (vf.atu === 'presencial' || vf.atu === 'hibrido') {
    const ok = !vf.ufs.size || [...pf.ufRes].some((u) => vf.ufs.has(u)) || pf.muda || [...pf.ufInt].some((u) => vf.ufs.has(u));
    if (!ok) return 'geografia';
  }
  if (vf.subNames.has(pf.nameN) || vf.linked.has(String(p.id))) return 'existente';
  return null;
}

// ---- Viabilidade (score quantitativo) ---------------------------------------
export const QUANT_LABEL = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
export const STATE_LABEL = { ok: 'ok', atencao: 'atenção', risco: 'risco', semdado: 'sem dado' };
const pct = (x) => `${Math.round(x * 100)}%`;

export function viabilidade(pf, vf) {
  const up = pf.level == null || vf.level == null ? null : vf.level - pf.level;
  const sen = up == null ? 'semdado' : up <= VIAB.SEN_OK ? 'ok' : up <= VIAB.SEN_ATENCAO ? 'atencao' : 'risco';
  const d = pf.salario && vf.salario ? Math.abs(vf.salario - pf.salario) / pf.salario : null;
  const sal = d == null ? 'semdado' : d <= VIAB.SAL_OK ? 'ok' : d <= VIAB.SAL_ATENCAO ? 'atencao' : 'risco';
  const parts = [
    { k: 'Senioridade', state: sen, max: VIAB.PESO_SEN, v: VIAB.PESO_SEN * VIAB.FATOR[sen],
      note: up == null ? 'sem senioridade de referência' : up <= 0 ? 'mesmo nível' : `vaga ${up.toLocaleString('pt-BR')} nível(is) acima`,
      rule: `até ${VIAB.SEN_OK} nível acima = ok · até ${VIAB.SEN_ATENCAO} = atenção · mais = risco` },
    { k: 'Salário', state: sal, max: VIAB.PESO_SAL, v: VIAB.PESO_SAL * VIAB.FATOR[sal],
      note: d == null ? 'salário atual ou previsto não informado (neutro)' : `diferença de ${pct(d)}`,
      rule: `≤ ${pct(VIAB.SAL_OK)} = ok · ≤ ${pct(VIAB.SAL_ATENCAO)} = atenção · mais = risco` },
  ];
  const states = parts.map((x) => x.state);
  const quant = states.includes('risco') ? 'baixo' : !states.includes('atencao') ? 'alto' : 'medio';
  const total = Math.round(parts.reduce((s, x) => s + x.v, 0) * 10) / 10;
  return { quant, total, parts };
}

// Urgency = days since availability (future availability = 0, no penalty).
const urgenciaOf = (p) => { const d = daysSince(p.dataDeDisponibilidade); return d == null ? null : Math.max(0, d); };

export function score(p, v) {
  const pf = perfilF(p), vf = vagaF(v);
  const { quant, total, parts } = viabilidade(pf, vf);
  const qual = aderencia(pf, vf);
  const compat = compatibilidadeFrom(p, v, pf.area, vf.area); // area lock (not part of the score)
  return { total, quant, qual, compat, urgencia: urgenciaOf(p), quad: quadrantOf(quant, qual, compat), parts };
}

export const maxRodada = (subs) => Math.max(0, ...(subs ?? []).map((s) => Number(String(clean(s.rodada) ?? '').match(/\d+/)?.[0] ?? 0)));
export const nextRodada = (v) => Math.min(MAX_RODADA, maxRodada(v.subitems) + 1);

export const eligibleVaga = (v) => VAGA_STATUS_OK.includes(nv(v.statusDaVaga)) && !!toDate(v.dataDeIncioPrevista);
export const eligiblePerfil = (p) => PERFIL_STATUS_OK.includes(nv(p.statusDoPerfil));

// Runs filters + score for the month → [{ vaga, rodada, sugestoes, all }]
export function runMatch(vagas, perfis, monthKey, { top = 5 } = {}) {
  const vs = vagas.filter((v) => eligibleVaga(v) && monthKeyOf(v.dataDeIncioPrevista) === monthKey);
  const ps = perfis.filter(eligiblePerfil);
  const results = vs.map((v) => {
    const all = ps.map((p) => ({ perfil: p, reason: eliminates(p, v, monthKey), ...score(p, v) })).sort(compareMatch);
    const sugestoes = all.filter((s) => !s.reason && s.quad !== 'descartar').slice(0, top);
    const full = maxRodada(v.subitems) >= MAX_RODADA;
    return { vaga: v, rodada: nextRodada(v), rodadaCheia: full, sugestoes, all, semInsumo: vagaF(v).semInsumo };
  });
  return { results, perfis: ps, vagasMes: vs.length, perfisElegiveis: ps.length, semCandidatos: results.filter((r) => !r.sugestoes.length).map((r) => r.vaga) };
}

export const REASONS = { mes: 'Indisponível no mês', vinculo: 'Vínculo diferente', senioridade: 'Senioridade abaixo da atual', geografia: 'Geografia', existente: 'Já indicado' };
