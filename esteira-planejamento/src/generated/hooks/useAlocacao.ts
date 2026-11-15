import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { piscar } from '@generated/components/fx/motion';
import { useVibeQuery, vibeQueryClient } from '@vibe/db/client';
import { ALOC_COLLECTIONS, AJUSTE_LABEL, type AlocAjuste, type AlocProjecao, type AlocHistorico } from '@generated/models';
import type { AlocDados, Doc } from '@generated/lib/alocacao';
import {
  getAlocacao, salvarAjuste, removerAjuste, salvarComentario, adicionarProjecao, removerProjecao,
  statusProjecoes, ajustesEmMassa, salvarHistorico, removerHistorico, importarTemperaturas, removerImportPendente,
} from '@generated/server/alocacao';
import { desfazerAcao } from '@generated/server/acoes';

// useVibeQuery namespaces every key under 'vibedb' (useQuery({ queryKey: ['vibedb', ...queryKey] })), so the
// cache keys below are derived from the SAME arrays passed to useVibeQuery — they can never drift apart.
export const Q_ALOC = ['alocacao'] as const;
/** Prefix of every Registro de ações query (['acoes', filtros] and ['acoes', 'autores']). */
export const Q_ACOES = ['acoes'] as const;
const KEY = ['vibedb', ...Q_ALOC];
const KEY_ACOES = ['vibedb', ...Q_ACOES];
const VAZIO: AlocDados = { ajustes: [], comentarios: [], projecoes: [], historico: [], importPendentes: [] };
const meta = (): Omit<Doc<unknown>, 'data'> => ({ id: `tmp-${Math.random().toString(36).slice(2)}`, createdAt: Date.now(), updatedAt: Date.now(), createdBy: '', updatedBy: '' });
const agora = () => ({ autor: 'Você', autorId: '', em: new Date().toISOString() });

export interface AcaoRegistrada { id: string; descricao: string }
type TipoAj = AlocAjuste['tipo'];
/** Readable names for the action log, set by the tab from the current model. */
export interface Rotulador {
  nome: (id: string) => string;
  atual: (tipo: TipoAj, id: string) => string;
  calc: (tipo: TipoAj, id: string) => string;
  perguntar: (p: { titulo?: string; texto: string; ok?: string }) => Promise<boolean>;
}
interface OpcoesMutar { semToast?: boolean; onAcao?: (a: AcaoRegistrada) => void }

const acaoDe = (r: unknown): (AcaoRegistrada & { falhaRegistro?: string }) | null => {
  const a = (r as { acao?: (AcaoRegistrada & { falhaRegistro?: string }) | null } | null | undefined)?.acao;
  return a && typeof a.id === 'string' ? a : null;
};

/** True while a projection only exists optimistically (not yet confirmed by the server). */
export const naoConfirmado = (id: string | undefined | null) => !!id && id.startsWith('tmp-');
const AGUARDE_HIST = () => toast.info('Aguarde o registro ser salvo', { description: 'Ele ainda está sendo gravado; tente de novo em instantes.' });
const AGUARDE = () => toast.info('Aguarde a projeção ser salva', { description: 'Ela ainda está sendo gravada; tente de novo em instantes.' });

// ---------- Rollback of ONE mutation (keeps concurrent optimistic edits) ----------
const CHAVES = ['ajustes', 'comentarios', 'projecoes', 'historico', 'importPendentes'] as const;
type Chave = (typeof CHAVES)[number];
type Delta = Record<Chave, { fora: Set<string>; volta: Doc<unknown>[] }>;
const docsDe = (d: AlocDados, k: Chave) => d[k] as Doc<unknown>[];
/** What the optimistic update changed: ids it added/replaced (`fora`) and the docs it removed/replaced (`volta`). */
function calcularDelta(antes: AlocDados, depois: AlocDados): Delta {
  const out = {} as Delta;
  for (const k of CHAVES) {
    const a = new Map(docsDe(antes, k).map((x) => [x.id, x]));
    const b = new Map(docsDe(depois, k).map((x) => [x.id, x]));
    out[k] = {
      fora: new Set([...b].filter(([id, x]) => a.get(id) !== x).map(([id]) => id)),
      volta: [...a].filter(([id, x]) => b.get(id) !== x).map(([, x]) => x),
    };
  }
  return out;
}
function reverter(atual: AlocDados, delta: Delta): AlocDados {
  const out = { ...atual } as Record<Chave, Doc<unknown>[]>;
  for (const k of CHAVES) {
    const { fora, volta } = delta[k];
    if (!fora.size && !volta.length) continue;
    const resto = docsDe(atual, k).filter((x) => !fora.has(x.id));
    const ids = new Set(resto.map((x) => x.id));
    out[k] = [...resto, ...volta.filter((x) => !ids.has(x.id))];
  }
  return out as unknown as AlocDados;
}

/**
 * Shared app-only data of "Alocação de Gerentes" (Vibe DB, realtime across users).
 * Every mutation: snapshot → optimistic cache update → server (logs the action) → rollback + toast on error;
 * on success a toast offers "Desfazer" (≈8 s).
 */
export function useAlocacao(enabled: boolean) {
  const q = useVibeQuery(Q_ALOC, () => getAlocacao({ data: {} }), { collections: ALOC_COLLECTIONS, enabled });
  const dados: AlocDados | null = q.data ? (q.data as AlocDados) : null;
  const rot = useRef<Rotulador>({
    nome: (id) => id, atual: () => '', calc: () => '',
    perguntar: async (p) => window.confirm(p.texto),
  });

  const invalidar = () => {
    void vibeQueryClient.invalidateQueries({ queryKey: KEY });
    void vibeQueryClient.invalidateQueries({ queryKey: KEY_ACOES });
  };

  /** Undoes one logged action (asks before overwriting later changes). */
  const desfazer = useCallback(async (id: string, silencioso = false): Promise<{ ok: boolean; aviso: string | null }> => {
    try {
      let r = await desfazerAcao({ data: { id } });
      if (r.status === 'conflito') {
        const ok = await rot.current.perguntar({
          titulo: 'Sobrescrever alterações posteriores?',
          texto: `Estes itens foram alterados depois desta ação:\n• ${r.conflitos.join('\n• ')}\n\nDesfazer vai voltar ao estado anterior e sobrescrever essas alterações.`,
          ok: 'Desfazer mesmo assim',
        });
        if (!ok) return { ok: false, aviso: null };
        r = await desfazerAcao({ data: { id, forcar: true } });
      }
      if (!silencioso) {
        toast.success('Ação desfeita', { description: r.acao?.descricao });
        if (r.aviso) toast.warning(r.aviso, { duration: 12000 });
      }
      return { ok: true, aviso: r.aviso };
    } catch (e) {
      console.error('Falha ao desfazer', e);
      toast.error('Não foi possível desfazer', { description: e instanceof Error ? e.message : 'Tente novamente.' });
      return { ok: false, aviso: null };
    } finally {
      invalidar();
    }
  }, []);

  const mutar = useCallback(async (otimista: (d: AlocDados) => AlocDados, chamada: () => Promise<unknown>, erro: string, op: OpcoesMutar = {}) => {
    const antes = vibeQueryClient.getQueryData<AlocDados>(KEY) ?? VAZIO;
    const depois = otimista(antes);
    const delta = calcularDelta(antes, depois);
    vibeQueryClient.setQueryData<AlocDados>(KEY, depois);
    try {
      const acao = acaoDe(await chamada());
      if (acao?.falhaRegistro) {
        toast.warning(acao.falhaRegistro, { description: acao.descricao, duration: 10000 });
      } else if (acao) {
        op.onAcao?.(acao);
        if (!op.semToast) {
          toast('Alteração salva', {
            description: acao.descricao, duration: 8000,
            action: { label: 'Desfazer', onClick: () => void desfazer(acao.id) },
          });
        }
      }
      return true;
    } catch (e) {
      console.error(erro, e);
      // Undo only this mutation's changes (other optimistic edits made meanwhile stay).
      vibeQueryClient.setQueryData<AlocDados>(KEY, (d) => reverter(d ?? VAZIO, delta));
      toast.error(erro, { description: e instanceof Error ? e.message : 'Tente novamente.' });
      return false;
    } finally {
      invalidar();
    }
  }, [desfazer]);

  const nomes = (ids: string[]) => Object.fromEntries([...new Set(ids)].map((i) => [i, rot.current.nome(i).slice(0, 300)]));

  const ajustar = (tipo: TipoAj, alvoId: string, valor: string, valores: string[] = []) => {
    const r = rot.current;
    const nome = r.nome(alvoId);
    const para = tipo === 'eixos' ? valores.join(', ') || '—' : valor;
    const descricao = tipo === 'desativado' ? `Desativado: ${nome}` : `${AJUSTE_LABEL[tipo]} de ${nome}: ${r.atual(tipo, alvoId) || '—'} → ${para}`;
    return mutar(
      (d) => ({
        ...d,
        ajustes: [...d.ajustes.filter((a) => !(a.data.tipo === tipo && a.data.alvoId === alvoId)), { ...meta(), data: { tipo, alvoId, valor, valores, ...agora() } }],
      }),
      () => salvarAjuste({ data: { tipo, alvoId, valor, valores, rot: { descricao: descricao.slice(0, 600), nomes: nomes([alvoId]) } } }),
      'Não foi possível salvar o ajuste',
    );
  };

  const voltarCalculado = (tipo: TipoAj, alvoId: string) => {
    const r = rot.current;
    const nome = r.nome(alvoId);
    const descricao = tipo === 'desativado' ? `Reativado: ${nome}` : `${AJUSTE_LABEL[tipo]} de ${nome}: ${r.atual(tipo, alvoId) || '—'} → calculado (${r.calc(tipo, alvoId) || '—'})`;
    return mutar(
      (d) => ({ ...d, ajustes: d.ajustes.filter((a) => !(a.data.tipo === tipo && a.data.alvoId === alvoId)) }),
      () => removerAjuste({ data: { tipo, alvoId, rot: { descricao: descricao.slice(0, 600), nomes: nomes([alvoId]) } } }),
      'Não foi possível voltar ao valor calculado',
    );
  };

  const comentar = (escopo: 'gerente' | 'projeto', alvoId: string, gerenteId: string, texto: string) => {
    const r = rot.current;
    const onde = `${r.nome(alvoId)}${gerenteId ? ` (${r.nome(gerenteId)})` : ''}`;
    const t = texto.trim();
    const descricao = t ? `Comentário em ${onde}: “${t.length > 120 ? `${t.slice(0, 120)}…` : t}”` : `Comentário removido em ${onde}`;
    return mutar(
      (d) => {
        const resto = d.comentarios.filter((c) => !(c.data.escopo === escopo && c.data.alvoId === alvoId && c.data.gerenteId === gerenteId));
        return { ...d, comentarios: t ? [...resto, { ...meta(), data: { escopo, alvoId, gerenteId, texto: t, ...agora() } }] : resto };
      },
      () => salvarComentario({ data: { escopo, alvoId, gerenteId, texto, rot: { descricao, nomes: nomes([alvoId]) } } }),
      'Não foi possível salvar o comentário',
    );
  };

  /** Adds a projection; with `substituirId` it replaces that one ("trocar gerente"). */
  const projetar = async (x: Pick<AlocProjecao, 'projetoId' | 'projetoNome' | 'destinoTipo' | 'gerenteId' | 'gerenteNome'> & { tipo: NonNullable<AlocProjecao['tipo']> }, substituirId?: string) => {
    if (naoConfirmado(substituirId)) { AGUARDE(); return false; }
    const ok = await mutar(
      (d) => ({
        ...d,
        projecoes: [...d.projecoes.filter((p) => p.id !== substituirId), { ...meta(), data: { ...x, status: 'Pendente', ...agora(), validadoPor: '', validadoEm: '' } }],
      }),
      () => adicionarProjecao({ data: { ...x, substituirId } }),
      'Não foi possível salvar a projeção',
    );
    // Visual only: highlight the confirmed project's row.
    if (ok) piscar(x.projetoId);
    return ok;
  };

  const desativar = (gerenteId: string, on: boolean) =>
    on ? ajustar('desativado', gerenteId, '1') : voltarCalculado('desativado', gerenteId);

  const salvarHist = async (x: Pick<AlocHistorico, 'gerenteId' | 'gerenteNome' | 'projetoNome' | 'eixo' | 'inicio' | 'fim'>, docId?: string) => {
    // A record still being created can't be edited (it would be created twice): wait for the confirmation.
    if (naoConfirmado(docId)) { AGUARDE_HIST(); return false; }
    return mutar(
      (d) => ({
        ...d,
        historico: docId
          ? d.historico.map((h) => (h.id === docId ? { ...h, data: { ...h.data, ...x, ...agora() } } : h))
          : [...d.historico, { ...meta(), data: { ...x, ...agora() } }],
      }),
      () => salvarHistorico({ data: { ...x, id: docId } }),
      'Não foi possível salvar o registro do histórico',
    );
  };

  const removerHist = async (docId: string) => {
    if (naoConfirmado(docId)) { AGUARDE_HIST(); return false; }
    return mutar(
      (d) => ({ ...d, historico: d.historico.filter((h) => h.id !== docId) }),
      () => removerHistorico({ data: { id: docId } }),
      'Não foi possível remover o registro',
    );
  };

  const importar = (atualizar: { projetoId: string; temp: string }[], pendentes: { nomeRelatorio: string; etapa: string; temp: string }[]) =>
    mutar(
      (d) => ({
        ...d,
        ajustes: [
          ...d.ajustes.filter((a) => !(a.data.tipo === 'temperatura' && atualizar.some((u) => u.projetoId === a.data.alvoId))),
          ...atualizar.map((u) => ({ ...meta(), data: { tipo: 'temperatura' as const, alvoId: u.projetoId, valor: u.temp, valores: [], ...agora() } })),
        ],
        importPendentes: pendentes.map((p) => ({ ...meta(), data: { ...p, ...agora() } })),
      }),
      () => importarTemperaturas({ data: { atualizar, pendentes, rot: { nomes: nomes(atualizar.map((u) => u.projetoId)) } } }),
      'Não foi possível aplicar a importação',
    );

  const descartarPendente = (docId: string) =>
    mutar(
      (d) => ({ ...d, importPendentes: d.importPendentes.filter((p) => p.id !== docId) }),
      () => (docId.startsWith('tmp-') ? Promise.resolve() : removerImportPendente({ data: { id: docId } })),
      'Não foi possível atualizar a lista de pendentes',
    );

  const desprojetar = async (id: string) => {
    if (naoConfirmado(id)) { AGUARDE(); return false; }
    const projetoId = vibeQueryClient.getQueryData<AlocDados>(KEY)?.projecoes.find((p) => p.id === id)?.data.projetoId;
    const ok = await mutar(
      (d) => ({ ...d, projecoes: d.projecoes.filter((p) => p.id !== id) }),
      () => removerProjecao({ data: { id } }),
      'Não foi possível remover a projeção',
    );
    if (ok && projetoId) piscar(projetoId);
    return ok;
  };

  /** `silencioso` (Validação loop): no per-item toast; the logged action is handed to `onAcao`. */
  const mudarStatus = async (ids: string[], status: AlocProjecao['status'], silencioso = false, onAcao?: (a: AcaoRegistrada) => void) => {
    if (ids.some(naoConfirmado)) { AGUARDE(); return false; }
    const projetoIds = [...new Set((vibeQueryClient.getQueryData<AlocDados>(KEY)?.projecoes ?? []).filter((p) => ids.includes(p.id)).map((p) => p.data.projetoId))];
    const ok = await mutar(
      (d) => ({
        ...d,
        projecoes: d.projecoes.map((p) => (ids.includes(p.id) ? { ...p, data: { ...p.data, status, validadoEm: status === 'Validada' ? new Date().toISOString() : '' } } : p)),
      }),
      () => statusProjecoes({ data: { ids, status } }),
      silencioso ? 'Falha ao atualizar o status no app' : 'Não foi possível atualizar o status',
      { semToast: silencioso, onAcao },
    );
    if (ok) projetoIds.forEach(piscar);
    return ok;
  };

  /** Bulk action bar: one optimistic update + one server call (rollback of the whole batch on error) + one log record. */
  const emMassa = (definir: { tipo: TipoAj; alvoId: string; valor: string }[], remover: { tipo: TipoAj; alvoId: string }[]) => {
    const k = (t: string, id: string) => `${t}|${id}`;
    const fora = new Set([...definir, ...remover].map((x) => k(x.tipo, x.alvoId)));
    const ids = [...new Set([...definir, ...remover].map((x) => x.alvoId))];
    const def0 = definir[0];
    const descricao = def0 && !remover.length && definir.every((x) => x.tipo === def0.tipo && x.valor === def0.valor)
      ? (def0.tipo === 'desativado' ? `Em massa: desativar ${ids.length} projeto(s)` : `Em massa: ${AJUSTE_LABEL[def0.tipo]} → ${def0.valor} (${ids.length} projeto(s))`)
      : !definir.length && remover.every((x) => x.tipo === 'desativado')
        ? `Em massa: reativar ${ids.length} projeto(s)`
        : !definir.length ? `Em massa: voltar ao calculado (${ids.length} projeto(s))` : `Ação em massa: ${ids.length} projeto(s)`;
    const lista = ids.slice(0, 8).map((i) => rot.current.nome(i)).join('; ');
    return mutar(
      (d) => ({
        ...d,
        ajustes: [
          ...d.ajustes.filter((a) => !fora.has(k(a.data.tipo, a.data.alvoId))),
          ...definir.map((x) => ({ ...meta(), data: { ...x, valores: [], ...agora() } })),
        ],
      }),
      () => ajustesEmMassa({ data: { definir, remover, rot: { descricao: `${descricao} — ${lista}${ids.length > 8 ? '…' : ''}`.slice(0, 600), nomes: nomes(ids) } } }),
      'Não foi possível aplicar a ação em massa',
    );
  };

  return {
    dados, loading: q.isLoading, error: q.isError ? 'Não foi possível carregar os dados de alocação do app.' : null,
    recarregar: () => void q.refetch(),
    ajustar, voltarCalculado, comentar, projetar, desprojetar, mudarStatus, emMassa,
    desativar, salvarHist, removerHist, importar, descartarPendente, desfazer, rot,
  };
}

export type AlocacaoApi = ReturnType<typeof useAlocacao>;
