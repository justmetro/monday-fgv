import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchHub, byRodada } from '@generated/lib/data';
import { SUB_BOARD } from '@generated/lib/boardMeta';
import { clean, normKey } from '@generated/lib/normalize';
import { isVagaAlocada, vagaEtapa } from '@generated/lib/esteira';
import { daysSince } from '@generated/lib/dates';

const INATIVO = new Set(['sem match', 'declinou', 'desligado (a)', 'despriorizado']);

const MATCH_DATA = ['rodada', 'statusDoMatch', 'resultadoDaRodada', 'dataDeEnvioDoCard', 'dataDaEntrevista', 'prximaAo'];
const nameOf = (x, fallback) => { const n = clean(x?.name); return typeof n === 'string' ? n : fallback; };

export function useHub() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async (initial) => {
    if (initial) setLoading(true); else setRefetching(true);
    setError(null);
    try {
      setRaw(await fetchHub());
      setUpdatedAt(new Date());
    } catch (e) {
      console.error('Erro ao carregar o quadro', e);
      setError(`Não foi possível carregar os dados do quadro. Tente atualizar. (${e?.errors?.[0]?.message ?? e?.message ?? e})`);
    } finally {
      setLoading(false); setRefetching(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const data = useMemo(() => {
    if (!raw) return { vagas: [], allVagas: [], perfis: [], progs: [], matches: [], allMatches: [], byId: {} };
    const tapMap = raw.tap?.byName ?? new Map();
    const perfis = (raw.perfis ?? []).map((p) => {
      const name = nameOf(p, 'Perfil sem nome');
      const t = tapMap.get(normKey(name));
      return { ...p, name, _matches: [], _tapOk: !!raw.tap?.ok, _noPlan: !!t, _fimTap: t?.fim ?? null, _tapProjetos: t?.projetos ?? [] };
    });
    const perfilById = Object.fromEntries(perfis.map((p) => [String(p.id), p]));
    const matches = [];
    const allMatches = [];
    const progs = (raw.progs ?? []).map((p) => ({ ...p, name: nameOf(p, 'Pedido sem nome') }));
    const allVagas = (raw.vagas ?? []).map((v0) => {
      const vaga = { ...v0, name: nameOf(v0, 'Vaga sem nome') };
      vaga._alocada = isVagaAlocada(vaga); // realocação/contratação concluída → fora das visualizações
      vaga._matches = [...(Array.isArray(vaga.subitems) ? vaga.subitems : [])].filter(Boolean).sort(byRodada).map((m0) => {
        const m = { ...m0, name: nameOf(m0, 'Match sem nome') };
        // Every linked profile counts (a match may point to more than one person).
        const linked = (Array.isArray(m.perfilVinculado?.linkedItems) ? m.perfilVinculado.linkedItems : []).filter((l) => l?.id);
        const seen = new Set();
        const links = linked.filter((l) => !seen.has(String(l.id)) && seen.add(String(l.id)))
          .map((l) => { const p = perfilById[String(l.id)]; return { id: String(l.id), name: p?.name ?? nameOf(l, 'Perfil'), perfil: p ?? null }; });
        const match = {
          ...m, _isMatch: true, _boardId: SUB_BOARD, _vagaId: vaga.id, _vagaName: vaga.name,
          _links: links.map(({ id, name }) => ({ id, name })), _perfilId: links[0]?.id ?? null, _semPerfil: !links.length,
          _multiPerfil: links.length > 1,
          _semDados: MATCH_DATA.every((k) => clean(m[k]) == null), _perfilAusente: links.length > 0 && links.every((l) => !l.perfil), _pessoa: links.length ? links.map((l) => l.name).join(' · ') : m.name,
        };
        allMatches.push(match);
        if (!vaga._alocada) { matches.push(match); links.forEach((l) => l.perfil?._matches.push(match)); }
        const di = daysSince(m.dataDaEntrevista);
        if (di != null && di >= 0) links.forEach((l) => { if (l.perfil) l.perfil._entrevistado = true; });
        return match;
      });
      return vaga;
    });
    perfis.forEach((p) => {
      p._matches.sort(byRodada);
      p._emRodada = p._matches.some((m) => !INATIVO.has(normKey(m.resultadoDaRodada)));
      p._entrevistado = !!p._entrevistado;
    });
    allVagas.forEach((v) => { v._etapa = vagaEtapa(v, perfilById); });
    const vagas = allVagas.filter((v) => !v._alocada);
    const byId = {};
    allVagas.forEach((x) => { byId[x.id] = { type: 'vaga', item: x }; }); // closed vagas stay reachable by id
    perfis.forEach((x) => { byId[x.id] = { type: 'perfil', item: x }; });
    progs.forEach((x) => { byId[x.id] = { type: 'prog', item: x }; });
    allMatches.forEach((x) => { byId[x.id] = { type: 'match', item: x }; });
    return { vagas, allVagas, perfis, progs, matches, allMatches, byId };
  }, [raw]);

  // Per-field optimistic patch (no refetch). `guard(current)` lets a rollback apply only if the
  // field still holds the value that edit wrote — later edits are never overwritten.
  const patch = useCallback((kind, id, key, value, guard) => setRaw((r) => {
    if (!r) return r;
    const hit = (x) => String(x.id) === String(id);
    const upd = (x) => (hit(x) && (!guard || guard(x[key] ?? null)) ? { ...x, [key]: value } : x);
    if (kind === 'perfil') return { ...r, perfis: r.perfis.map(upd) };
    if (kind === 'vaga') return { ...r, vagas: r.vagas.map(upd) };
    // Subitem: located by its own id across all parents (no parent mapping required).
    return { ...r, vagas: r.vagas.map((v) => (Array.isArray(v.subitems) && v.subitems.some(hit) ? { ...v, subitems: v.subitems.map(upd) } : v)) };
  }), []);

  return { data, meta: raw?.meta ?? null, loading, refetching, error, updatedAt, patch, reload: () => load(false) };
}
