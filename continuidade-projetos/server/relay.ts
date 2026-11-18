// Gravações no monday feitas pelo navegador de quem está usando o app.
// Enquanto uma função do servidor roda a pedido de alguém (cabeçalho x-call-id), cada mutation vira um pedido
// no banco; o navegador busca os pedidos, executa com monday.api (login da pessoa, sem token) e devolve a resposta.
// Sem pessoa na chamada (agendamentos, rotinas que continuam depois da resposta), a mutation usa o token do app.
import { randomBytes } from 'node:crypto';
import { mongo } from './mongo';
import { currentCtx } from './context';

export const SEM_NAVEGADOR = Symbol('sem-navegador');

type Status = 'pendente' | 'enviada' | 'ok' | 'erro' | 'expirada';
interface Pedido { _id: string; callId: string; userId: string; query: string; variables: unknown; status: Status; resposta?: unknown; erro?: string; at: number }

const col = async () => (await mongo()).collection<Pedido>('app_mutacoes');
const LIMITE_MS = 120_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ultimaLimpeza = 0;
async function limpar() {
  if (Date.now() - ultimaLimpeza < 60 * 60_000) return;
  ultimaLimpeza = Date.now();
  await (await col()).deleteMany({ at: { $lt: Date.now() - 24 * 60 * 60_000 } }).catch(() => null);
}

/** Resposta crua do GraphQL ({ data, errors, ... }) executada no navegador, ou SEM_NAVEGADOR. */
export async function viaNavegador(query: string, variables: unknown): Promise<unknown> {
  const ctx = currentCtx();
  if (!ctx?.callId || ctx.viaCron || ctx.encerrada) return SEM_NAVEGADOR;
  const c = await col();
  const _id = randomBytes(12).toString('hex');
  await c.insertOne({ _id, callId: ctx.callId, userId: ctx.userId, query, variables: variables ?? {}, status: 'pendente', at: Date.now() });
  void limpar();
  const fim = Date.now() + LIMITE_MS;
  let passo = 150;
  while (Date.now() < fim) {
    await espera(passo);
    passo = Math.min(passo + 100, 500);
    const p = await c.findOne({ _id });
    if (p?.status === 'ok') return p.resposta;
    if (p?.status === 'erro') return { errors: [{ message: p.erro || 'Falha ao gravar no monday pelo navegador.' }] };
  }
  await c.updateOne({ _id, status: { $in: ['pendente', 'enviada'] } }, { $set: { status: 'expirada' } });
  throw new Error('A gravação não foi confirmada pelo navegador a tempo. Mantenha a aba aberta e tente novamente.');
}

/** Long-poll do navegador: devolve os pedidos pendentes da chamada (cada um uma única vez). */
export async function pendentes(callId: string, userId: string, esperarMs = 8000) {
  const c = await col();
  const fim = Date.now() + esperarMs;
  for (;;) {
    const lista: { id: string; query: string; variables: unknown }[] = [];
    for (;;) {
      const p = await c.findOneAndUpdate({ callId, userId, status: 'pendente' }, { $set: { status: 'enviada' } }, { sort: { at: 1 }, returnDocument: 'after' });
      const doc = (p && 'value' in (p as object) ? (p as { value: Pedido | null }).value : (p as Pedido | null));
      if (!doc) break;
      lista.push({ id: doc._id, query: doc.query, variables: doc.variables });
    }
    if (lista.length || Date.now() >= fim) return lista;
    await espera(200);
  }
}

export async function registrarResultado(id: string, userId: string, resposta: unknown, erro?: string) {
  await (await col()).updateOne(
    { _id: id, userId, status: 'enviada' },
    { $set: erro ? { status: 'erro', erro: String(erro).slice(0, 1000) } : { status: 'ok', resposta } },
  );
}
