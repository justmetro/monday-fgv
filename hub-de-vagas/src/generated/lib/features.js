import { clean } from '@generated/lib/normalize';
import { list, nv, level, parseUFs, eixoOf, EIXO_MAP, words } from '@generated/lib/matchBase';
import { detect, alerts, canonComp, nn, normText, vagaCompetencias } from '@generated/lib/competencias';
import { perfilArea, vagaArea, tituloVaga } from '@generated/lib/compatibilidadeArea';
import { toDate } from '@generated/lib/data';

// Per-item feature cache. Board reloads produce new objects, so entries die with the old data.
let PF = new WeakMap();
let VF = new WeakMap();
export const resetFeatures = () => { PF = new WeakMap(); VF = new WeakMap(); };

const hasTxt = (x) => { const c = clean(x); return typeof c === 'string' && c.trim().length > 0; };
const notInf = (x) => nn(x) !== 'nao informado';

export function perfilF(p) {
  let f = PF.get(p);
  if (f) return f;
  const areas = list(p.perfilReasDeAtuao);
  const comps = list(p.competnciasEHabilidades).map(canonComp);
  const ints = list(p.principaisInteresses).filter(notInf);
  const ativRaw = clean(p.principaisAtividadesEntregas);
  const cov = [areas.length > 0, comps.length > 0, hasTxt(ativRaw), hasTxt(p.pontosFortes), hasTxt(p.pontosDeMelhoria), ints.length > 0];
  const disp = toDate(p.dataDeDisponibilidade);
  f = {
    areas: areas.map((x) => ({ raw: x, t: nn(x) })),
    comps: new Set(comps),
    ints: ints.map((x) => ({ raw: x, t: nn(x) })),
    ativ: hasTxt(ativRaw) ? { raw: ativRaw, nt: normText(ativRaw), found: detect(ativRaw) } : null,
    fortes: hasTxt(p.pontosFortes) ? detect(p.pontosFortes, 'fortes') : null,
    mel: hasTxt(p.pontosDeMelhoria) ? detect(p.pontosDeMelhoria, 'melhoria') : null,
    alerts: alerts(p.observaesPerfil),
    area: perfilArea(p),
    cover: cov.filter(Boolean).length,
    level: level(p.senioridadeAtual),
    vin: nv(p.vnculo),
    disp: disp ? disp.getTime() : null,
    ufRes: new Set(list(p.ufDeResidncia).map((u) => String(u).toUpperCase())),
    ufInt: parseUFs(p.ufsDeInteresse),
    muda: nv(p.interesseEmMudarDeCidade) === 'sim',
    nameN: nv(p.name),
    salario: Number(p.salrioAtualR) > 0 ? Number(p.salrioAtualR) : null,
  };
  PF.set(p, f);
  return f;
}

export function vagaF(v) {
  let f = VF.get(v);
  if (f) return f;
  const titulo = tituloVaga(v.name);
  const cargoText = [titulo, clean(v.cargoPapel)].filter(Boolean).join(' ');
  const ex = eixoOf(v, cargoText);
  const em = ex.key ? EIXO_MAP[ex.key] : null;
  const vagaAtivRaw = clean(v.principaisAtividadesVaga);
  const subs = v.subitems ?? [];
  f = {
    key: vagaCompetencias(v, cargoText),
    eixoAreas: em ? new Set(em.areas.map(nn)) : null,
    eixoInts: em ? new Set(em.ints.map(nn)) : null,
    targets: [
      { label: 'projeto', text: nn(clean(v.projeto) ?? '') },
      { label: 'cargo', text: nn(cargoText) },
      { label: 'eixo', text: nn(clean(v.eixoDeAtuao) ?? '') },
    ],
    cargoWords: words(cargoText).filter((w) => w.length >= 4),
    vagaAtiv: hasTxt(vagaAtivRaw) ? detect(vagaAtivRaw) : null,
    area: vagaArea(v),
    level: level(v.senioridadeVaga),
    mod: nv(v.modalidadeDeContratao),
    atu: nv(v.modalidadeDeAtuaoVaga),
    ufs: new Set(list(v.ufDeAtuao).map((x) => String(x).toUpperCase())),
    subNames: new Set(subs.map((s) => nv(s.name))),
    linked: new Set(subs.flatMap((s) => (s.perfilVinculado?.linkedItems ?? []).map((l) => String(l.id)))),
    salario: Number(v.salrioPrevistoR) > 0 ? Number(v.salrioPrevistoR) : null,
    semInsumo: !list(v.competnciasEssenciais).length && !list(v.competnciasDesejveis).length && !hasTxt(vagaAtivRaw),
  };
  VF.set(v, f);
  return f;
}
