import { db } from '@vibe/db/server';
import type { VibeCollection } from '@vibe/db';
import { getCurrentUser } from '@api/current-user.server';
import { alocAcoes, type AcaoTipo, type AlocMudanca, type JsonObj } from '@generated/models';

export interface Autoria { autor: string; autorId: string; em: string }
/** `falhaRegistro`: the change was saved but the log record wasn't (id = '', no undo). */
export interface AcaoInfo { id: string; tipo: AcaoTipo; descricao: string; falhaRegistro?: string }

export async function autoria(): Promise<Autoria> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Não foi possível identificar o seu usuário para registrar a alteração.');
  return { autor: user.name || 'Usuário', autorId: String(user.id), em: new Date().toISOString() };
}

const RETENCAO_MS = 90 * 24 * 60 * 60 * 1000;
export const corteRetencao = () => new Date(Date.now() - RETENCAO_MS).toISOString();

/** Plain JSON copy (drops undefined) — the same shape that is stored and read back. */
export const json = (x: object | null | undefined): JsonObj | null => (x ? (JSON.parse(JSON.stringify(x)) as JsonObj) : null);

/** Key-order independent serialization, to compare the current doc with the logged `depois`. */
export function estavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estavel).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${estavel((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * Collects every doc change of ONE app action (state read before writing) and saves it as a single
 * "aloc_acoes" record. Logging never fails the action itself.
 */
export class Registro {
  readonly mudancas: AlocMudanca[] = [];
  constructor(readonly a: Autoria) {}

  private anotar(colecao: string, docId: string, alvo: string, antes: object | null, depois: object | null) {
    this.mudancas.push({ colecao, docId, alvo: alvo.slice(0, 300), antes: json(antes), depois: json(depois) });
  }

  async add<T extends object>(c: VibeCollection<T>, data: T, alvo: string) {
    const d = await db.collection(c).add(data);
    this.anotar(c.name, d.id, alvo, null, d.data);
    return d;
  }

  /** Create-or-replace; `antes` may be passed when already read (undefined = read it now). */
  async set<T extends object>(c: VibeCollection<T>, docId: string, data: T, alvo: string, antes?: T | null) {
    const prev = antes !== undefined ? antes : ((await db.collection(c).doc(docId).get())?.data ?? null);
    const d = await db.collection(c).doc(docId).set(data);
    this.anotar(c.name, docId, alvo, prev, d.data);
    return d;
  }

  async update<T extends object>(c: VibeCollection<T>, docId: string, parcial: Partial<T>, alvo: string, antes?: T | null) {
    const prev = antes !== undefined ? antes : ((await db.collection(c).doc(docId).get())?.data ?? null);
    const d = await db.collection(c).doc(docId).update(parcial);
    this.anotar(c.name, docId, alvo, prev, d.data);
    return d;
  }

  async remove<T extends object>(c: VibeCollection<T>, docId: string, alvo: string, antes?: T | null) {
    const prev = antes !== undefined ? antes : ((await db.collection(c).doc(docId).get())?.data ?? null);
    if (!prev) return;
    await db.collection(c).doc(docId).delete();
    this.anotar(c.name, docId, alvo, prev, null);
  }

  async salvar(tipo: AcaoTipo, descricao: string, extra: { itens?: number; desfazDe?: string } = {}): Promise<AcaoInfo | null> {
    if (!this.mudancas.length) return null;
    try {
      const col = db.collection(alocAcoes);
      const d = await col.add({
        lote: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, tipo, descricao: descricao.slice(0, 600), ...this.a,
        desfeita: false, desfeitaPor: '', desfeitaEm: '',
        itens: extra.itens ?? this.mudancas.length, mudancas: this.mudancas,
        ...(extra.desfazDe ? { desfazDe: extra.desfazDe } : {}),
      });
      await limparAntigos();
      return { id: d.id, tipo, descricao: d.data.descricao };
    } catch (e) {
      console.error('Falha ao gravar o registro de ações', e);
      return {
        id: '', tipo, descricao: descricao.slice(0, 600),
        falhaRegistro: 'A alteração foi salva, mas não entrou no Registro de ações — ela não poderá ser desfeita pelo app.',
      };
    }
  }
}

/** Keeps only the last 90 days (runs on each write). */
async function limparAntigos() {
  try {
    const col = db.collection(alocAcoes);
    const velhos = await col.where('em', '<', corteRetencao()).limit(100).get();
    await Promise.all(velhos.map((v) => col.doc(v.id).delete()));
  } catch (e) {
    console.error('Falha ao limpar registros antigos', e);
  }
}
