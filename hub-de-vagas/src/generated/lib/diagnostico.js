import { eligibleVaga, eligiblePerfil, eliminates, monthKeyOf, score } from '@generated/lib/autoMatch';
import { perfilF, vagaF } from '@generated/lib/features';
import { MAX_EXPLICITAS } from '@generated/lib/compatibilidadeArea';
import { VAGA_FIELDS, PERFIL_FIELDS } from '@generated/lib/config';
import { clean, normKey } from '@generated/lib/normalize';

const keyOf = (c) => (c.semInfo ? 'sem' : String(c.level));
const filled = (v) => {
  const c = clean(v);
  if (c == null) return false;
  if (Array.isArray(c)) return c.some((x) => normKey(x) !== 'nao informado');
  if (typeof c === 'number') return c > 0;
  return typeof c !== 'string' || (c.trim() !== '' && normKey(c) !== 'nao informado');
};
const coverage = (items, fields) => fields.filter((f) => f.cov).map((f) => ({ ...f, n: items.filter((it) => filled(it[f.prop])).length, N: items.length }));
const origem = (a) => (a.source === 'explicita' ? 'explicita' : a.source === 'inferida' ? 'inferida' : a.kind === 'generalista' ? 'generalista' : 'sem');
const tick = () => new Promise((r) => { (window.requestIdleCallback ?? ((f) => setTimeout(f, 0)))(() => r()); });

// Same data refs → same result (no recompute when the dialog is reopened).
let memo = { vagas: null, perfis: null, result: null };

// Read-only diagnostics over every eligible perfil × open vaga (any month). Batched so the UI never freezes.
export async function diagnosticoAsync(vagas, perfis, onProgress, isCancelled = () => false) {
  if (memo.vagas === vagas && memo.perfis === perfis && memo.result) return memo.result;
  const vs = vagas.filter(eligibleVaga);
  const ps = perfis.filter(eligiblePerfil);
  const totals = { 2: 0, 1: 0, 0: 0, sem: 0 };
  const dist = { quant: { alto: 0, medio: 0, baixo: 0 }, qual: { alta: 0, media: 0, baixa: 0 }, quad: { indicar: 0, potencial: 0, verificar: 0, descartar: 0 }, eliminados: 0, pares: 0 };
  const porVaga = [];
  const BATCH = 4;
  for (let i = 0; i < vs.length; i += BATCH) {
    if (isCancelled()) return null;
    vs.slice(i, i + BATCH).forEach((v) => {
      const c = { 2: 0, 1: 0, 0: 0, sem: 0, indicar: 0 };
      const mk = monthKeyOf(v.dataDeIncioPrevista);
      ps.forEach((p) => {
        const s = score(p, v);
        const k = keyOf(s.compat); c[k] += 1; totals[k] += 1;
        dist.pares += 1; dist.quant[s.quant] += 1; dist.qual[s.qual.band] += 1; dist.quad[s.quad] += 1;
        const elim = eliminates(p, v, mk);
        if (elim) dist.eliminados += 1;
        else if (s.quad === 'indicar') c.indicar += 1;
      });
      porVaga.push({ vaga: v, ...c });
    });
    onProgress?.(Math.min(vs.length, i + BATCH), vs.length);
    await tick(); // eslint-disable-line no-await-in-loop
  }
  const perfilInfo = ps.map((p) => ({ item: p, a: perfilF(p).area }));
  const vagaInfo = vs.map((v) => ({ item: v, a: vagaF(v).area }));
  const sortName = (a, b) => a.item.name.localeCompare(b.item.name, 'pt');
  const count = (l) => l.reduce((o, x) => { o[origem(x.a)] += 1; return o; }, { explicita: 0, inferida: 0, generalista: 0, sem: 0 });
  const result = {
    nVagas: vs.length, nPerfis: ps.length, totals, porVaga, dist,
    origem: { perfis: count(perfilInfo), vagas: count(vagaInfo) },
    cobertura: { perfis: coverage(ps, PERFIL_FIELDS), vagas: coverage(vs, VAGA_FIELDS) },
    explicitasDemais: [...perfilInfo, ...vagaInfo].filter((x) => x.a.source === 'explicita' && x.a.fams.length > MAX_EXPLICITAS).sort(sortName),
    perfisSem: perfilInfo.filter((x) => !x.a.fams.length).sort(sortName),
    vagasSem: vagaInfo.filter((x) => !x.a.fams.length).sort(sortName),
    inferidos: [...perfilInfo.map((x) => ({ ...x, kind: 'perfil' })), ...vagaInfo.map((x) => ({ ...x, kind: 'vaga' }))].filter((x) => x.a.source === 'inferida').sort(sortName),
    pctPerfisSem: ps.length ? perfilInfo.filter((x) => !x.a.fams.length).length / ps.length : 0,
  };
  memo = { vagas, perfis, result };
  return result;
}
