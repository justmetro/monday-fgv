import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { gql, gqlApp } from '../../../server/monday';
import { currentCtx } from '../../../server/context';

// Quadro de dados (só CoPlan) e quadro de acesso (gerentes como assinantes, tem a aba do app).
export const BOARD = 18441323203;
export const BOARD_ACESSO = 18441325686;
export const ITEM_ACESSO = 13626485007;
export const BOARD_PLAN = 18412010674;
export const BOARD_MAPA = 18422833691;

const C = {
  gerente: 'multiple_person_mm9dqqyb',
  status: 'color_mm9dny50',
  vig: 'timerange_mm9de2ac',
  ultimo: 'date_mm9d5q0m',
  vigOk: 'timerange_mm9dgge7',
  ultimoOk: 'date_mm9dwzw4',
  obs: 'long_text_mm9dbty1',
  id02: 'text_mm9dpdv2',
  prazo: 'date_mm9d4xyp',
  email: 'text_mm9dt26h',
  desaloca: 'color_mm9d3prr',
  saidas: 'long_text_mm9d3857',
};
const PLAN = { vig: 'timerange_mm6vw3pb', ultimo: 'date_mm5g69fd' };

import { DESALOCA, type Item, type Eu, type Registro } from '../tipos';
import { mongo } from '../../../server/mongo';

async function registrar(e: Eu, acao: string, item: Pick<Item, 'id' | 'nome'>, detalhe = '') {
  const r: Omit<Registro, 'id'> = { em: new Date().toISOString(), usuarioId: e.id, usuario: e.nome, perfil: e.coplan ? 'CoPlan' : 'Gerente', acao, itemId: item.id, projeto: item.nome, detalhe };
  await (await mongo()).collection('log_conferencia').insertOne(r as Record<string, unknown>).catch((x) => console.error('[log]', x));
}

let cacheDonos: { at: number; ids: Set<string> } | null = null;
async function donos(): Promise<Set<string>> {
  if (cacheDonos && Date.now() - cacheDonos.at < 5 * 60_000) return cacheDonos.ids;
  const d = await gql<{ boards: { owners: { id: string }[] }[] }>('query ($b: [ID!]) { boards(ids: $b) { owners { id } } }', { b: [BOARD] });
  cacheDonos = { at: Date.now(), ids: new Set((d.boards[0]?.owners ?? []).map((o) => String(o.id))) };
  return cacheDonos.ids;
}

async function eu(): Promise<Eu> {
  const ctx = currentCtx();
  if (!ctx?.userId) throw new Error('Sessão sem usuário.');
  const d = await gql<{ users: { id: string; name: string; email: string; kind: string }[] }>('query ($ids: [ID!]) { users(ids: $ids) { id name email kind } }', { ids: [ctx.userId] });
  const u = d.users[0];
  if (!u) throw new Error('Usuário não encontrado.');
  const coplan = (await donos()).has(String(u.id));
  return { id: String(u.id), nome: u.name, email: (u.email ?? '').toLowerCase(), coplan };
}

function txt(cv: Record<string, { text: string | null; value: string | null }>, id: string) {
  return (cv[id]?.text ?? '').trim();
}
function faixa(v: string) {
  const [de = '', ate = ''] = v ? v.split(' - ') : [];
  return { de, ate };
}

async function todos(): Promise<Item[]> {
  const out: Item[] = [];
  let cursor: string | null = null;
  const campos = `id name column_values { id text value ... on PeopleValue { persons_and_teams { id kind } } }`;
  do {
    const d: any = cursor
      ? await gql(`query ($c: String!) { next_items_page(limit: 100, cursor: $c) { cursor items { ${campos} } } }`, { c: cursor })
      : await gql(`query ($b: [ID!]) { boards(ids: $b) { items_page(limit: 100) { cursor items { ${campos} } } } }`, { b: [BOARD] });
    const page: any = cursor ?d.next_items_page : d.boards[0].items_page;
    for (const it of page.items) {
      const cv: Record<string, any> = Object.fromEntries(it.column_values.map((c: any) => [c.id, c]));
      const v = faixa(txt(cv, C.vig)), vo = faixa(txt(cv, C.vigOk));
      out.push({
        id: String(it.id),
        nome: it.name,
        gerentes: (cv[C.gerente]?.persons_and_teams ?? []).filter((p: any) => p.kind === 'person').map((p: any) => ({ id: String(p.id), nome: '' })),
        emails: txt(cv, C.email).toLowerCase().split(/[,;\s]+/).filter(Boolean),
        status: txt(cv, C.status) || 'Não iniciado',
        vigDe: v.de, vigAte: v.ate, ultimo: txt(cv, C.ultimo),
        vigOkDe: vo.de, vigOkAte: vo.ate, ultimoOk: txt(cv, C.ultimoOk),
        obs: txt(cv, C.obs), id02: txt(cv, C.id02), prazo: txt(cv, C.prazo), linkQuadro: '', linkSGI: '', desaloca: txt(cv, C.desaloca), saidas: txt(cv, C.saidas),
      });
    }
    cursor = page.cursor;
  } while (cursor);
  const ids02 = [...new Set(out.map((i) => i.id02).filter((x) => /^\d+$/.test(x)))];
  const links = new Map<string, { q: string; s: string }>();
  const url = (v: string | null) => { try { return String(JSON.parse(v ?? '{}')?.url ?? ''); } catch { return ''; } };
  for (let k = 0; k < ids02.length; k += 100) {
    const d = await gql<{ items: { id: string; column_values: { id: string; value: string | null }[] }[] }>('query ($ids: [ID!]) { items(ids: $ids, limit: 100) { id column_values(ids: ["link_mm383m1p", "link_mm39c5rc"]) { id value } } }', { ids: ids02.slice(k, k + 100) });
    d.items.forEach((it) => {
      const c = Object.fromEntries(it.column_values.map((x) => [x.id, x.value]));
      links.set(String(it.id), { q: url(c.link_mm383m1p), s: url(c.link_mm39c5rc) });
    });
  }
  out.forEach((i) => { const l = links.get(i.id02); if (l) { i.linkQuadro = l.q; i.linkSGI = l.s; } });
  const nomeMapa = new Map<string, string>();
  // Mapa de Gerentes é a fonte principal: projeto do 02.01 ligado em "Projetos Gerenciados" -> e-mail do gerente.
  try {
    const dm = await gql<{ boards: { items_page: { items: { group: { title: string }; column_values: { id: string; text: string | null; linked_item_ids?: string[] }[] }[] } }[] }>(
      'query ($b: [ID!]) { boards(ids: $b) { items_page(limit: 500) { items { name group { title } column_values(ids: ["board_relation_mm5epxs", "email_mm5eqgfn"]) { id text ... on BoardRelationValue { linked_item_ids } } } } } }',
      { b: [BOARD_MAPA] },
    );
    const mapa = new Map<string, string[]>();
    for (const g of dm.boards[0]?.items_page.items ?? []) {
      if (g.group.title !== 'Gerentes') continue;
      const c = Object.fromEntries(g.column_values.map((x) => [x.id, x]));
      const em = (c.email_mm5eqgfn?.text ?? '').trim().toLowerCase();
      if (!em) continue;
      nomeMapa.set(em, (g as any).name ?? '');
      for (const p of c.board_relation_mm5epxs?.linked_item_ids ?? []) mapa.set(String(p), [...new Set([...(mapa.get(String(p)) ?? []), em])]);
    }
    out.forEach((i) => {
      const m = mapa.get(i.id02);
      if (m?.length) { i.emails = m; i.gerentes = []; }
    });
  } catch (x) {
    console.error('[mapa de gerentes]', x);
  }
  // Gerente só por e-mail (sem acesso ao quadro de dados para ir na coluna Pessoa): resolve o usuário pelo e-mail.
  const semId = [...new Set(out.flatMap((i) => i.emails))];
  if (semId.length) {
    const porEmail = new Map<string, string>();
    for (let k = 0; k < semId.length; k += 100) {
      const d = await gql<{ users: { id: string; email: string }[] }>('query ($e: [String!]) { users(emails: $e, limit: 100) { id email } }', { e: semId.slice(k, k + 100) });
      d.users.forEach((u) => porEmail.set(u.email.toLowerCase(), String(u.id)));
    }
    out.forEach((i) => i.emails.forEach((em) => {
      const id = porEmail.get(em);
      if (id && !i.gerentes.some((g) => g.id === id)) i.gerentes.push({ id, nome: '' });
    }));
  }
  const ids = [...new Set(out.flatMap((i) => i.gerentes.map((g) => g.id)))];
  if (ids.length) {
    const nomes = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 100) {
      const d = await gql<{ users: { id: string; name: string; email: string }[] }>('query ($ids: [ID!]) { users(ids: $ids, limit: 100) { id name email } }', { ids: ids.slice(i, i + 100) });
      d.users.forEach((u) => nomes.set(String(u.id), nomeMapa.get((u.email ?? '').toLowerCase()) || u.name));
    }
    out.forEach((i) => i.gerentes.forEach((g) => { g.nome = nomes.get(g.id) ?? ''; }));
  }
  return out;
}

const ehDoGerente = (i: Item, e: Eu) => i.gerentes.some((g) => g.id === e.id) || (!!e.email && i.emails.includes(e.email));

/** Inclui no quadro de dados os projetos novos do grupo da esteira do 02.01 (não mexe nos que já estão lá). */
async function sincronizarNovos(simular = false): Promise<string[]> {
  const ja = new Set<string>();
  let cursor: string | null = null;
  do {
    const d: any = cursor
      ? await gql('query ($c: String!) { next_items_page(limit: 200, cursor: $c) { cursor items { column_values(ids: ["' + C.id02 + '"]) { text } } } }', { c: cursor })
      : await gql('query ($b: [ID!]) { boards(ids: $b) { items_page(limit: 200) { cursor items { column_values(ids: ["' + C.id02 + '"]) { text } } } } }', { b: [BOARD] });
    const page: any = cursor ? d.next_items_page : d.boards[0].items_page;
    page.items.forEach((it: any) => { const t = it.column_values[0]?.text; if (t) ja.add(String(t).trim()); });
    cursor = page.cursor;
  } while (cursor);
  const novos: { id: string; name: string; vig: string | null; ult: string | null }[] = [];
  cursor = null;
  do {
    const campos = 'cursor items { id name column_values(ids: ["' + PLAN.vig + '", "' + PLAN.ultimo + '"]) { id value } }';
    const d: any = cursor
      ? await gql('query ($c: String!) { next_items_page(limit: 200, cursor: $c) { ' + campos + ' } }', { c: cursor })
      : await gql('query ($b: [ID!]) { boards(ids: $b) { groups(ids: ["topics"]) { items_page(limit: 200) { ' + campos + ' } } } }', { b: [BOARD_PLAN] });
    const page: any = cursor ? d.next_items_page : d.boards[0].groups[0].items_page;
    for (const it of page.items) {
      if (ja.has(String(it.id))) continue;
      const c = Object.fromEntries(it.column_values.map((x: any) => [x.id, x.value]));
      novos.push({ id: String(it.id), name: it.name, vig: c[PLAN.vig], ult: c[PLAN.ultimo] });
    }
    cursor = page.cursor;
  } while (cursor);
  if (simular) return novos.map((n) => n.name);
  for (const n of novos) {
    const cv: Record<string, unknown> = { [C.id02]: n.id };
    try { const v = JSON.parse(n.vig ?? 'null'); if (v?.from && v?.to) cv[C.vig] = { from: v.from, to: v.to }; } catch { /* sem vigência */ }
    try { const u = JSON.parse(n.ult ?? 'null'); if (u?.date) cv[C.ultimo] = { date: u.date }; } catch { /* sem data */ }
    const d = await gql<{ create_item: { id: string } }>('mutation ($b: ID!, $n: String!, $v: JSON!) { create_item(board_id: $b, group_id: "topics", item_name: $n, column_values: $v) { id } }', { b: BOARD, n: n.name, v: JSON.stringify(cv) });
    await registrar(ROTINA, 'Projeto novo incluído', { id: String(d.create_item.id), nome: n.name }).catch(() => {});
  }
  return novos.map((n) => n.name);
}

export const carregar = createServerFn({ method: 'POST' }).handler(async () => {
  const e = await eu();
  if (e.coplan) await sincronizarNovos().catch((x) => console.error('[sincronizar]', x));
  const itens = await todos();
  return { eu: e, itens: e.coplan ? itens : itens.filter((i) => ehDoGerente(i, e)) };
});

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional();

export const responder = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string(), conferida: z.boolean(), vigDe: data, vigAte: data, ultimo: data, obs: z.string().max(2000).optional(), desaloca: z.enum(['toda', 'parte']), saidas: z.string().max(2000).optional() }))
  .handler(async ({ data: d }) => {
    const e = await eu();
    const item = (await todos()).find((i) => i.id === d.itemId);
    if (!item) throw new Error('Projeto não encontrado.');
    if (!e.coplan && !ehDoGerente(item, e)) throw new Error('Este projeto não está sob sua gerência.');
    if (d.desaloca === 'parte' && !d.saidas?.trim()) throw new Error('Informe quem sai antes da data de fim e quando.');
    const cv: Record<string, unknown> = {
      [C.status]: { label: d.conferida ? 'Datas conferidas' : 'Datas corrigidas' },
      [C.desaloca]: { label: DESALOCA[d.desaloca] },
      [C.saidas]: d.desaloca === 'parte' ? { text: d.saidas!.trim() } : null,
    };
    if (!d.conferida) {
      if (!d.vigDe && !d.vigAte && !d.ultimo) throw new Error('Informe ao menos uma data correta.');
      if (d.vigDe || d.vigAte) {
        const de = d.vigDe || item.vigDe, ate = d.vigAte || item.vigAte;
        if (!de || !ate) throw new Error('Informe início e fim da vigência.');
        if (de > ate) throw new Error('O início da vigência é depois do fim.');
        cv[C.vigOk] = { from: de, to: ate };
      }
      if (d.ultimo) cv[C.ultimoOk] = { date: d.ultimo };
    } else {
      cv[C.vigOk] = null;
      cv[C.ultimoOk] = null;
    }
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const nota = `${hoje} ${e.nome}: ${d.conferida ? 'datas conferidas' : 'datas corrigidas'}${d.obs?.trim() ? `. ${d.obs.trim()}` : ''}`;
    cv[C.obs] = { text: item.obs ? `${item.obs}\n${nota}` : nota };
    // Gerente não acessa o quadro de dados: grava no nome do app.
    await gqlApp('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: BOARD, i: item.id, v: JSON.stringify(cv) });
    const det = d.conferida ? '' : [
      cv[C.vigOk] ? `vigência ${String((cv[C.vigOk] as any).from).split('-').reverse().join('/')} a ${String((cv[C.vigOk] as any).to).split('-').reverse().join('/')}` : '',
      d.ultimo ? `último produto ${d.ultimo.split('-').reverse().join('/')}` : '',
    ].filter(Boolean).join('; ');
    await registrar(e, d.conferida ? 'Confirmou as datas' : 'Corrigiu as datas', item, [det, d.desaloca === 'parte' ? `parte da equipe sai antes: ${d.saidas!.trim()}` : 'toda a equipe desaloca na data de fim', d.obs?.trim()].filter(Boolean).join('. '));
    return { ok: true };
  });

async function notificar(userId: string, texto: string) {
  await gqlApp('mutation ($u: ID!, $t: ID!, $x: String!) { create_notification(user_id: $u, target_id: $t, target_type: Project, text: $x) { text } }', { u: userId, t: ITEM_ACESSO, x: texto });
}

async function pedirConferencia(e: Eu, itens: Item[], prazo: string | undefined, acao: string) {
  const porGerente = new Map<string, Item[]>();
  let semGerente = 0;
  for (const i of itens) {
    const cv: Record<string, unknown> = { [C.status]: { label: 'Revisar datas' } };
    if (prazo) cv[C.prazo] = { date: prazo };
    await gqlApp('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: BOARD, i: i.id, v: JSON.stringify(cv) });
    await registrar(e, acao, i, [i.gerentes.map((g) => g.nome).join(', ') || 'sem gerente', prazo ? `prazo ${br(prazo)}` : ''].filter(Boolean).join('; '));
    if (!i.gerentes.length) semGerente++;
    i.gerentes.forEach((g) => porGerente.set(g.id, [...(porGerente.get(g.id) ?? []), i]));
  }
  // Garante que todo gerente notificado consiga abrir o painel (assinante do quadro de acesso).
  if (porGerente.size) {
    await gqlApp('mutation ($b: ID!, $u: [ID!]!) { add_users_to_board(board_id: $b, user_ids: $u, kind: subscriber) { id } }', { b: BOARD_ACESSO, u: [...porGerente.keys()] }).catch((x) => console.error('[acesso]', x));
  }
  const prazoTxt = prazo ? ` até ${br(prazo)}` : '';
  for (const [uid, lista] of porGerente) {
    await notificar(uid, `A CoPlan pede que você confira${prazoTxt} as datas de fim de ${lista.length === 1 ? 'um projeto' : `${lista.length} projetos`}: ${resumo(lista)}. Abra a aba Painel neste quadro.`);
  }
  return { atualizados: itens.length, notificados: porGerente.size, semGerente };
}

const br = (d: string) => d.split('-').reverse().join('/');
const resumo = (l: { nome: string }[]) => l.slice(0, 3).map((i) => i.nome).join('; ') + (l.length > 3 ? ` e mais ${l.length - 3}` : '');

export const solicitar = createServerFn({ method: 'POST' })
  .validator(z.object({ itemIds: z.array(z.string()).min(1).max(200), prazo: data }))
  .handler(async ({ data: d }) => {
    const e = await eu();
    if (!e.coplan) throw new Error('Só a CoPlan pede conferência.');
    const itens = (await todos()).filter((i) => d.itemIds.includes(i.id));
    return pedirConferencia(e, itens, d.prazo || undefined, 'Pediu conferência');
  });

export const aplicarNo0201 = createServerFn({ method: 'POST' })
  .validator(z.object({ itemIds: z.array(z.string()).min(1).max(200) }))
  .handler(async ({ data: d }) => {
    const e = await eu();
    if (!e.coplan) throw new Error('Só a CoPlan atualiza o 02.01.');
    const itens = (await todos()).filter((i) => d.itemIds.includes(i.id) && i.status === 'Datas corrigidas' && i.id02);
    for (const i of itens) {
      const cv: Record<string, unknown> = {};
      if (i.vigOkDe && i.vigOkAte) cv[PLAN.vig] = { from: i.vigOkDe, to: i.vigOkAte };
      if (i.ultimoOk) cv[PLAN.ultimo] = { date: i.ultimoOk };
      if (Object.keys(cv).length) {
        // Grava no 02.01 no nome de quem está na tela (CoPlan).
        await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: BOARD_PLAN, i: i.id02, v: JSON.stringify(cv) });
      }
      const atual: Record<string, unknown> = { [C.status]: { label: 'Atualizado no 02.01' } };
      if (i.vigOkDe && i.vigOkAte) atual[C.vig] = { from: i.vigOkDe, to: i.vigOkAte };
      if (i.ultimoOk) atual[C.ultimo] = { date: i.ultimoOk };
      await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: BOARD, i: i.id, v: JSON.stringify(atual) });
      await registrar(e, 'Aplicou a correção no 02.01', i);
    }
    return { atualizados: itens.length };
  });

export const carregarLog = createServerFn({ method: 'POST' }).handler(async () => {
  const e = await eu();
  if (!e.coplan) throw new Error('O histórico é só da CoPlan.');
  const docs = await (await mongo()).collection('log_conferencia').find({}).sort({ em: -1 }).limit(2000).toArray();
  return docs.map(({ _id, ...r }) => ({ id: String(_id), ...r })) as unknown as Registro[];
});

/** Job diário: lembra cada gerente dos projetos ainda em "Revisar datas". */
// ---------- Rotina diária (agendador, 09:00 de Brasília em dias úteis) ----------
const ROTINA: Eu = { id: '0', nome: 'Rotina diária', email: '', coplan: true };
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const somaDias = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400_000);
const fimDe = (i: Item) => i.ultimoOk || i.ultimo;

const SGI = { foco: 'person', status: 'color_mm7y8hwt', envio: 'date_mm97q7ts' };

/** IO2.1.1: avisa o Ponto Focal do 02.01 a cada dia útil nos 7 dias após o envio da equipe ao SGI. */
async function lembreteSGI(hoje: string, simular: boolean) {
  const q = `query ($b: [ID!], $c: String) { boards(ids: $b) { items_page(limit: 100, cursor: $c) { cursor items { id name column_values(ids: ["${SGI.foco}", "${SGI.status}", "${SGI.envio}"]) { id text value } } } } }`;
  const enviados: { id: string; nome: string; foco: string[]; dia: number }[] = [];
  let cursor: string | null = null;
  do {
    const d: any = await gql(q, { b: [BOARD_PLAN], c: cursor });
    const pg = d.boards[0].items_page;
    for (const it of pg.items) {
      const cv = Object.fromEntries(it.column_values.map((c: any) => [c.id, c]));
      const envio = (cv[SGI.envio]?.text ?? '').trim();
      if ((cv[SGI.status]?.text ?? '') !== 'Enviada' || !envio) continue;
      const foco = (JSON.parse(cv[SGI.foco]?.value || '{}').personsAndTeams ?? []).filter((p: any) => p.kind === 'person').map((p: any) => String(p.id));
      enviados.push({ id: String(it.id), nome: it.name, foco, dia: diasEntre(envio, hoje) });
    }
    cursor = pg.cursor;
  } while (cursor);
  const avisar = enviados.filter((x) => x.dia >= 1 && x.dia <= 8 && x.foco.length);
  if (!simular) {
    for (const x of avisar) {
      const texto = x.dia <= 7
        ? `IO2.1.1: dia ${x.dia} de 7 desde o envio da equipe de ${x.nome} ao SGI. Confira no SGI se a equipe já foi aprovada e, se sim, marque Aprovada na coluna Equipe no SGI.`
        : `IO2.1.1: a equipe de ${x.nome} passou de 7 dias no SGI sem aprovação registrada. Confira no SGI e atualize a coluna Equipe no SGI.`;
      for (const u of x.foco) await gqlApp('mutation ($u: ID!, $t: ID!, $x: String!) { create_notification(user_id: $u, target_id: $t, target_type: Project, text: $x) { text } }', { u, t: x.id, x: texto }).catch((err) => console.error('[sgi]', err));
    }
  }
  return { enviadas: enviados.length, avisados: avisar.map((x) => `${x.nome} (dia ${x.dia})`) };
}

export async function rotinaDiaria(arg?: string) {
  const simular = arg === 'simular';
  const hoje = hojeBR();
  const incluidos = await sincronizarNovos(simular).catch((x) => { console.error('[sincronizar]', x); return [] as string[]; });
  const itens = await todos();
  const col = (await mongo()).collection<{ _id: string; em: string }>('alertas_coplan');

  // 1) 120 dias: pede a conferência automaticamente aos gerentes.
  const a120 = itens.filter((i) => { const f = fimDe(i); if (!f || i.status !== 'Não iniciado') return false; const n = diasEntre(hoje, f); return n > 0 && n <= 120; });
  const pedido = simular ? null : await pedirConferencia(ROTINA, a120, somaDias(hoje, 7), 'Pedido automático (120 dias)');

  // 2) 90 e 60 dias: avisa a CoPlan uma vez por marco, só para o que ainda não chegou ao 02.01.
  const marcos: Record<'90' | '60', Item[]> = { '90': [], '60': [] };
  for (const i of itens) {
    const f = fimDe(i);
    if (!f || i.status === 'Atualizado no 02.01') continue;
    const n = diasEntre(hoje, f);
    if (n <= 0) continue;
    const marco = n <= 60 ? '60' : n <= 90 ? '90' : null;
    if (!marco) continue;
    const chave = `${i.id}:${marco}:${f}`;
    if (await col.findOne({ _id: chave })) continue;
    marcos[marco].push(i);
    if (!simular) await col.insertOne({ _id: chave, em: new Date().toISOString() });
  }
  const coplan = [...(await donos())];
  if (!simular) {
    for (const m of ['90', '60'] as const) {
      const l = marcos[m];
      if (!l.length) continue;
      const pend = l.filter((i) => i.status === 'Revisar datas' || i.status === 'Não iniciado').length;
      const texto = `Conferência de datas: ${l.length === 1 ? 'um projeto chegou' : `${l.length} projetos chegaram`} a ${m} dias do último produto: ${resumo(l)}.${pend ? ` ${pend} ainda sem resposta do gerente.` : ''} Veja no Painel.`;
      for (const u of coplan) await notificar(u, texto).catch((x) => console.error('[coplan]', x));
    }
  }

  // 3) Lembrete aos gerentes com conferência pendente (sem repetir quem foi avisado agora).
  const novos = new Set(a120.map((i) => i.id));
  const pend = itens.filter((i) => i.status === 'Revisar datas' && !novos.has(i.id));
  const porGerente = new Map<string, Item[]>();
  pend.forEach((i) => i.gerentes.forEach((g) => porGerente.set(g.id, [...(porGerente.get(g.id) ?? []), i])));
  if (!simular) {
    for (const [uid, lista] of porGerente) {
      const atrasados = lista.filter((i) => i.prazo && i.prazo < hoje).length;
      await notificar(uid, `Lembrete da CoPlan: ${lista.length === 1 ? 'um projeto aguarda' : `${lista.length} projetos aguardam`} a conferência das datas de fim${atrasados ? ` (${atrasados} com prazo vencido)` : ''}: ${resumo(lista)}. Abra a aba Painel neste quadro.`).catch((x) => console.error('[lembrete]', x));
    }
  }

  // 4) IO2.1.1 no 02.01.
  const sgi = await lembreteSGI(hoje, simular);

  return {
    hoje, simular, incluidos,
    pedidos120: a120.map((i) => i.nome), pedido,
    alerta90: marcos['90'].map((i) => i.nome), alerta60: marcos['60'].map((i) => i.nome),
    lembretes: { gerentes: porGerente.size, projetos: pend.length },
    sgi,
  };
}

export async function lembretePendentes() {
  const pend = (await todos()).filter((i) => i.status === 'Revisar datas');
  const hoje = new Date().toISOString().slice(0, 10);
  const porGerente = new Map<string, Item[]>();
  pend.forEach((i) => i.gerentes.forEach((g) => porGerente.set(g.id, [...(porGerente.get(g.id) ?? []), i])));
  for (const [uid, lista] of porGerente) {
    const atrasados = lista.filter((i) => i.prazo && i.prazo < hoje).length;
    await notificar(uid, `Lembrete da CoPlan: ${lista.length === 1 ? 'um projeto aguarda' : `${lista.length} projetos aguardam`} a conferência das datas de fim${atrasados ? ` (${atrasados} com prazo vencido)` : ''}. Abra a aba Painel neste quadro.`);
  }
  return { gerentes: porGerente.size, projetos: pend.length };
}
