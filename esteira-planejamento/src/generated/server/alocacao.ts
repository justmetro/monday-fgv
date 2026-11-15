import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import {
  alocAjustes, alocComentarios, alocProjecoes, alocHistorico, alocImportPendentes, alocRegraCapacidade, AJUSTE_LABEL, type AlocAjuste,
} from '@generated/models';
import { autoria, Registro } from '@generated/server/acoes.server';
import { obterBase } from '@generated/server/base-dados';

const id = z.string().min(1).max(64);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const diaOuVazio = z.union([dia, z.literal('')]);
const TIPOS_AJUSTE = ['temperatura', 'complexidade', 'capacidade', 'eixos', 'desativado'] as const;
/** Readable labels sent by the client for the action log (description + target names). */
const rot = z.object({
  descricao: z.string().max(600).optional(),
  nomes: z.record(z.string(), z.string().max(300)).optional(),
}).optional();
type Rot = z.infer<typeof rot>;
const nomeDe = (r: Rot, alvoId: string) => r?.nomes?.[alvoId] ?? alvoId;
const TIPO_PROJ: Record<string, string> = { novo: 'Novo', reforco: 'Reforço', troca: 'Troca' };

type Pagina<T> = { getPage: () => Promise<{ docs: T[]; cursor?: string }>; startAfter: (c: string) => { getPage: () => Promise<{ docs: T[]; cursor?: string }> } };
/** Reads a whole (small) collection page by page. */
async function todos<T extends object>(ref: Pagina<T>) {
  const out: T[] = [];
  let page = await ref.getPage();
  out.push(...page.docs);
  let guard = 0;
  while (page.cursor && guard++ < 50) {
    page = await ref.startAfter(page.cursor).getPage();
    out.push(...page.docs);
  }
  return out;
}

async function lerNucleo() {
  // Old "aloc_simulacoes" records are ignored (simulation was removed).
  const [ajustes, comentarios, projecoes] = await Promise.all([
    todos(db.collection(alocAjustes).limit(1000)),
    todos(db.collection(alocComentarios).limit(1000)),
    todos(db.collection(alocProjecoes).limit(1000)),
  ]);
  return { ajustes, comentarios, projecoes };
}

export const getAlocacao = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const [nucleo, historico, importPendentes] = await Promise.all([
      lerNucleo(),
      todos(db.collection(alocHistorico).limit(1000)),
      todos(db.collection(alocImportPendentes).limit(1000)),
    ]);
    return { ...nucleo, historico, importPendentes };
  });

// ---------- Ajustes ----------
type AjusteIn = Pick<AlocAjuste, 'tipo' | 'alvoId' | 'valor' | 'valores'>;
async function upsertAjuste(reg: Registro, data: AjusteIn, alvo: string) {
  const existentes = await db.collection(alocAjustes).where('tipo', '==', data.tipo).where('alvoId', '==', data.alvoId).get();
  const doc = { ...data, ...reg.a };
  const [primeiro, ...extras] = existentes;
  await Promise.all(extras.map((e) => reg.remove(alocAjustes, e.id, alvo, e.data)));
  return primeiro ? reg.set(alocAjustes, primeiro.id, doc, alvo, primeiro.data) : reg.add(alocAjustes, doc, alvo);
}
async function apagarAjustes(reg: Registro, tipo: AlocAjuste['tipo'], alvoId: string, alvo: string) {
  const ex = await db.collection(alocAjustes).where('tipo', '==', tipo).where('alvoId', '==', alvoId).get();
  await Promise.all(ex.map((e) => reg.remove(alocAjustes, e.id, alvo, e.data)));
  return ex.length;
}

export const salvarAjuste = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({
    tipo: z.enum(TIPOS_AJUSTE),
    alvoId: id,
    valor: z.string().max(60),
    valores: z.array(z.string().min(1).max(80)).max(20),
    rot,
  }).parse(d))
  .handler(async ({ data }) => {
    const { rot: r, ...x } = data;
    const reg = new Registro(await autoria());
    const alvo = nomeDe(r, x.alvoId);
    await upsertAjuste(reg, x, alvo);
    const desc = r?.descricao ?? (x.tipo === 'desativado' ? `Desativado: ${alvo}` : `${AJUSTE_LABEL[x.tipo]} de ${alvo}: → ${x.valor || x.valores.join(', ') || '—'}`);
    return { acao: await reg.salvar(x.tipo === 'desativado' ? 'desativar' : 'ajuste', desc) };
  });

export const removerAjuste = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ tipo: z.enum(TIPOS_AJUSTE), alvoId: id, rot }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const alvo = nomeDe(data.rot, data.alvoId);
    const removidos = await apagarAjustes(reg, data.tipo, data.alvoId, alvo);
    const desc = data.rot?.descricao ?? (data.tipo === 'desativado' ? `Reativado: ${alvo}` : `${AJUSTE_LABEL[data.tipo]} de ${alvo}: → calculado`);
    return { removidos, acao: await reg.salvar(data.tipo === 'desativado' ? 'reativar' : 'voltar_calculado', desc) };
  });

/** Bulk: sets and removes several adjustments in one call (multi-selection action bar) — ONE log record. */
export const ajustesEmMassa = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({
    definir: z.array(z.object({ tipo: z.enum(TIPOS_AJUSTE), alvoId: id, valor: z.string().max(60) })).max(1000),
    remover: z.array(z.object({ tipo: z.enum(TIPOS_AJUSTE), alvoId: id })).max(1000),
    rot,
  }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const tarefas: (() => Promise<unknown>)[] = [
      ...data.definir.map((x) => () => upsertAjuste(reg, { ...x, valores: [] }, nomeDe(data.rot, x.alvoId))),
      ...data.remover.map((x) => () => apagarAjustes(reg, x.tipo, x.alvoId, nomeDe(data.rot, x.alvoId))),
    ];
    for (let i = 0; i < tarefas.length; i += 10) await Promise.all(tarefas.slice(i, i + 10).map((t) => t()));
    const alvos = new Set([...data.definir, ...data.remover].map((x) => x.alvoId)).size;
    const acao = await reg.salvar('massa', data.rot?.descricao ?? `Ação em massa: ${alvos} item(ns)`, { itens: alvos });
    return { definidos: data.definir.length, removidos: data.remover.length, acao };
  });

// ---------- Comentários ----------
export const salvarComentario = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({
    escopo: z.enum(['gerente', 'projeto']),
    alvoId: id,
    gerenteId: z.string().max(64),
    texto: z.string().max(2000),
    rot,
  }).parse(d))
  .handler(async ({ data }) => {
    const { rot: r, ...x } = data;
    const reg = new Registro(await autoria());
    const alvo = nomeDe(r, x.alvoId);
    const existentes = await db.collection(alocComentarios).where('escopo', '==', x.escopo).where('alvoId', '==', x.alvoId).where('gerenteId', '==', x.gerenteId).get();
    const texto = x.texto.trim();
    if (!texto) {
      await Promise.all(existentes.map((e) => reg.remove(alocComentarios, e.id, alvo, e.data)));
    } else {
      const [primeiro, ...extras] = existentes;
      await Promise.all(extras.map((e) => reg.remove(alocComentarios, e.id, alvo, e.data)));
      const doc = { ...x, texto, ...reg.a };
      if (primeiro) await reg.set(alocComentarios, primeiro.id, doc, alvo, primeiro.data);
      else await reg.add(alocComentarios, doc, alvo);
    }
    return { acao: await reg.salvar('comentario', r?.descricao ?? `Comentário em ${alvo}${texto ? '' : ' removido'}`) };
  });

// ---------- Projeções ----------
const projecaoInput = z.object({
  projetoId: id,
  projetoNome: z.string().max(300),
  destinoTipo: z.enum(['gerente', 'cdpe', 'novo', 'externo']),
  gerenteId: z.string().max(64),
  gerenteNome: z.string().max(200),
  tipo: z.enum(['novo', 'reforco', 'troca']),
});

export const adicionarProjecao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => projecaoInput.extend({ substituirId: z.string().max(64).optional() }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const { substituirId, ...x } = data;
    // A single "Novo gerente" identity (no numbering).
    if (x.destinoTipo === 'novo') { x.gerenteId = 'novo'; x.gerenteNome = 'Novo gerente'; }
    const col = db.collection(alocProjecoes);
    const alvo = `${x.projetoNome} → ${x.gerenteNome || 'CDPE'}`;
    const antiga = substituirId ? await col.doc(substituirId).get() : null;
    const desc = antiga
      ? `Troca de projeção em ${x.projetoNome}: ${antiga.data.gerenteNome || 'CDPE'} → ${x.gerenteNome || 'CDPE'} (${TIPO_PROJ[x.tipo]})`
      : `Projeção (${TIPO_PROJ[x.tipo]}): ${alvo}`;
    const tipoAcao = antiga ? 'trocar_projecao' : 'projetar';
    const chave = (e: { destinoTipo: string; gerenteId: string }) => (e.destinoTipo === 'cdpe' || e.destinoTipo === 'novo' ? e.destinoTipo : `${e.destinoTipo}:${e.gerenteId}`);
    // "Trocar": the replaced projection is ignored in every check and only deleted
    // after the new one is saved, so a failed check never loses the original projection.
    const existentes = (await col.where('projetoId', '==', x.projetoId).get()).filter((e) => e.id !== substituirId);
    const dup = existentes.find((e) => chave(e.data) === chave(x) && e.data.status === 'Pendente');
    if (dup) {
      if (dup.data.tipo !== x.tipo) await reg.update(alocProjecoes, dup.id, { tipo: x.tipo }, alvo, dup.data);
      if (antiga) await reg.remove(alocProjecoes, antiga.id, alvo, antiga.data);
      return { doc: dup, acao: await reg.salvar(tipoAcao, desc) };
    }
    let aguardandoDe = 0;
    if (x.destinoTipo === 'gerente') {
      // Limit counts pending destinations AND validated ones the 02.01 doesn't show yet (relation without this manager).
      const doGerente = (await col.where('gerenteId', '==', x.gerenteId).get())
        .filter((e) => e.id !== substituirId && e.data.destinoTipo === 'gerente' && e.data.projetoId !== x.projetoId);
      const pendentes = new Set(doGerente.filter((e) => e.data.status === 'Pendente').map((e) => e.data.projetoId));
      const validadas = doGerente.filter((e) => e.data.status === 'Validada' && !pendentes.has(e.data.projetoId));
      let aguardando = 0;
      if (validadas.length) {
        const { items } = await obterBase(false);
        const porId = new Map(items.map((i) => [i.id, i]));
        aguardando = new Set(validadas.filter((e) => {
          const p = porId.get(e.data.projetoId);
          return !!p && !(p.gerente?.linkedItems ?? []).some((li) => String(li.id) === x.gerenteId);
        }).map((e) => e.data.projetoId)).size;
      }
      aguardandoDe = aguardando;
      if (pendentes.size + aguardando >= 3) {
        throw new Error(`Este gerente já tem 3 projetos destino (limite)${aguardando ? ` — inclui ${aguardando} validado(s) aguardando sincronizar com o 02.01` : ''}.`);
      }
    }
    const novo = await reg.add(alocProjecoes, { ...x, status: 'Pendente', ...reg.a, validadoPor: '', validadoEm: '' }, alvo);
    if (x.destinoTipo === 'gerente') {
      // Concurrency re-check: two users may pass the check at the same time. The earliest projects
      // (by creation) keep their places; if this one is beyond the limit, it is removed (no action logged).
      const pend = (await col.where('gerenteId', '==', x.gerenteId).get())
        .filter((e) => e.id !== substituirId && e.data.destinoTipo === 'gerente' && e.data.status === 'Pendente');
      const primeiro = new Map<string, { em: number; id: string }>();
      for (const e of pend) {
        const em = e.createdAt ?? 0;
        const atual = primeiro.get(e.data.projetoId);
        if (!atual || em < atual.em || (em === atual.em && e.id < atual.id)) primeiro.set(e.data.projetoId, { em, id: e.id });
      }
      const ordem = [...primeiro.entries()].sort((a, b) => a[1].em - b[1].em || a[1].id.localeCompare(b[1].id)).map(([pid]) => pid);
      if (ordem.length + aguardandoDe > 3 && ordem.indexOf(x.projetoId) >= Math.max(0, 3 - aguardandoDe)) {
        await col.doc(novo.id).delete();
        throw new Error(`Este gerente já tem 3 projetos destino (limite)${aguardandoDe ? ` — inclui ${aguardandoDe} validado(s) aguardando sincronizar com o 02.01` : ''}.`);
      }
    }
    if (antiga) await reg.remove(alocProjecoes, antiga.id, alvo, antiga.data);
    return { doc: novo, acao: await reg.salvar(tipoAcao, desc) };
  });

export const removerProjecao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const doc = await db.collection(alocProjecoes).doc(data.id).get();
    if (!doc) return { acao: null };
    const alvo = `${doc.data.projetoNome} → ${doc.data.gerenteNome || 'CDPE'}`;
    await reg.remove(alocProjecoes, doc.id, alvo, doc.data);
    return { acao: await reg.salvar('remover_projecao', `Projeção removida: ${alvo}`) };
  });

export const statusProjecoes = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ ids: z.array(id).min(1).max(50), status: z.enum(['Pendente', 'Validada']) }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const col = db.collection(alocProjecoes);
    const extra = data.status === 'Validada' ? { validadoPor: reg.a.autor, validadoEm: reg.a.em } : { validadoPor: '', validadoEm: '' };
    const docs = (await Promise.all(data.ids.map((i) => col.doc(i).get()))).flatMap((d) => (d ? [d] : []));
    await Promise.all(docs.map((d) => reg.update(alocProjecoes, d.id, { status: data.status, ...extra }, `${d.data.projetoNome} → ${d.data.gerenteNome || 'CDPE'}`, d.data)));
    const projetos = [...new Set(docs.map((d) => d.data.projetoNome))].join('; ');
    const gerentes = [...new Set(docs.map((d) => d.data.gerenteNome || 'CDPE'))].join(', ');
    const desc = data.status === 'Validada' ? `Validada: ${projetos} → ${gerentes}` : `Status voltou a Pendente: ${projetos} (${gerentes})`;
    return { atualizados: docs.length, acao: await reg.salvar(data.status === 'Validada' ? 'validar' : 'desfazer_status', desc) };
  });

// ---------- Histórico (manual records) ----------
const historicoInput = z.object({
  gerenteId: z.string().max(64),
  gerenteNome: z.string().min(1).max(200),
  projetoNome: z.string().trim().min(1).max(300),
  eixo: z.string().max(80),
  inicio: diaOuVazio,
  fim: diaOuVazio,
});

export const salvarHistorico = createServerFn({ method: 'POST' })
  .validator((d: unknown) => historicoInput.extend({ id: z.string().max(64).optional() }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const { id: docId, ...x } = data;
    const alvo = `${x.projetoNome} (${x.gerenteNome})`;
    if (docId) await reg.set(alocHistorico, docId, { ...x, ...reg.a }, alvo);
    else await reg.add(alocHistorico, { ...x, ...reg.a }, alvo);
    const acao = await reg.salvar(docId ? 'historico_editar' : 'historico_adicionar', `Histórico de ${x.gerenteNome}: ${x.projetoNome} ${docId ? 'editado' : 'adicionado'}`);
    return { acao };
  });

export const removerHistorico = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const doc = await db.collection(alocHistorico).doc(data.id).get();
    if (!doc) return { acao: null };
    await reg.remove(alocHistorico, doc.id, `${doc.data.projetoNome} (${doc.data.gerenteNome})`, doc.data);
    return { acao: await reg.salvar('historico_remover', `Histórico de ${doc.data.gerenteNome}: ${doc.data.projetoNome} removido`) };
  });

// ---------- Importação de temperaturas ----------
export const importarTemperaturas = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({
    atualizar: z.array(z.object({ projetoId: id, temp: z.string().min(1).max(60) })).max(500),
    // Each pending line is validated on its own (see handler): a bad line never rejects the whole batch.
    pendentes: z.array(z.unknown()).max(500),
    rot,
  }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    for (const u of data.atualizar) await upsertAjuste(reg, { tipo: 'temperatura', alvoId: u.projetoId, valor: u.temp, valores: [] }, nomeDe(data.rot, u.projetoId));
    // Long texts are truncated to the accepted limit instead of failing.
    const corta = (n: number) => z.string().transform((s) => s.trim().slice(0, n));
    const linha = z.object({ nomeRelatorio: corta(400).pipe(z.string().min(1)), etapa: corta(200), temp: corta(60) });
    const validas = data.pendentes.map((p) => linha.safeParse(p)).flatMap((r) => (r.success ? [r.data] : []));
    // The latest import replaces the previous pending list (old ones are logged, so undo restores them).
    const antigos = await todos(db.collection(alocImportPendentes).limit(1000));
    await Promise.all(antigos.map((p) => reg.remove(alocImportPendentes, p.id, `Pendente: ${p.data.nomeRelatorio}`, p.data)));
    for (const p of validas) await reg.add(alocImportPendentes, { ...p, ...reg.a }, `Pendente: ${p.nomeRelatorio}`);
    const acao = await reg.salvar('importacao',
      data.rot?.descricao ?? `Importação de PDF: ${data.atualizar.length} temperatura(s), ${validas.length} pendente(s) (lista anterior de ${antigos.length} substituída)`,
      { itens: data.atualizar.length + validas.length });
    return { atualizados: data.atualizar.length, pendentes: validas.length, rejeitados: data.pendentes.length - validas.length, acao };
  });

export const removerImportPendente = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const doc = await db.collection(alocImportPendentes).doc(data.id).get();
    if (!doc) return { acao: null };
    await reg.remove(alocImportPendentes, doc.id, `Pendente: ${doc.data.nomeRelatorio}`, doc.data);
    return { acao: await reg.salvar('descartar_pendente', `Pendente descartado: ${doc.data.nomeRelatorio}`) };
  });

// ---------- Regra de capacidade (ajustável) ----------
const diasRegra = z.number().int().min(1).max(3650);
const regraInput = z.object({ curtoDias: diasRegra, medioDias: diasRegra, longoDias: diasRegra })
  .refine((r) => r.curtoDias < r.medioDias && r.medioDias < r.longoDias, { message: 'As faixas devem ser crescentes: Curto < Médio < Longo.' });

export const getRegraCapacidade = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const [doc] = await db.collection(alocRegraCapacidade).limit(1).get();
    return doc ? { curtoDias: doc.data.curtoDias, medioDias: doc.data.medioDias, longoDias: doc.data.longoDias } : null;
  });

export const salvarRegraCapacidade = createServerFn({ method: 'POST' })
  .validator((d: unknown) => regraInput.parse(d))
  .handler(async ({ data }) => {
    const reg = new Registro(await autoria());
    const [existente] = await db.collection(alocRegraCapacidade).limit(1).get();
    const doc = { ...data, ...reg.a };
    const alvo = 'Regra de capacidade';
    if (existente) await reg.set(alocRegraCapacidade, existente.id, doc, alvo, existente.data);
    else await reg.add(alocRegraCapacidade, doc, alvo);
    const desc = `Regra de capacidade: Curto até ${data.curtoDias} d · Médio até ${data.medioDias} d · Longo até ${data.longoDias} d`;
    return { acao: await reg.salvar('regra_capacidade', desc) };
  });

export const resetRegraCapacidade = createServerFn({ method: 'POST' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const reg = new Registro(await autoria());
    const existentes = await db.collection(alocRegraCapacidade).limit(10).get();
    await Promise.all(existentes.map((e) => reg.remove(alocRegraCapacidade, e.id, 'Regra de capacidade', e.data)));
    return { acao: await reg.salvar('regra_capacidade', 'Regra de capacidade: voltou ao padrão (30 / 60 / 90 dias)') };
  });
