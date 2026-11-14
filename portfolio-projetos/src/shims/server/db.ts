// Substitui o @vibe/db do Vibe por MongoDB (Document DB do monday code).
import { MongoClient, type Db, type Filter, type Document } from 'mongodb';
import { randomUUID } from 'node:crypto';

export type VibeDoc<T> = { id: string; data: T };
type Def = { name: string; indexes?: (string | string[])[] };
export function defineCollection<T>(def: Def) { return def as Def & { __t?: T }; }

let dbp: Promise<Db> | null = null;
export function getDb() {
  if (!dbp) {
    const uri = process.env.MNDY_MONGODB_CONNECTION_STRING || process.env.MONGO_URL;
    if (!uri) throw new Error('Banco de dados não configurado.');
    dbp = new MongoClient(uri).connect().then((c) => c.db());
  }
  return dbp;
}
const ensured = new Set<string>();
async function coll(def: Def) {
  const d = await getDb();
  const c = d.collection(def.name);
  if (!ensured.has(def.name)) {
    ensured.add(def.name);
    for (const ix of def.indexes ?? []) {
      const spec: Record<string, 1> = {};
      ([] as string[]).concat(ix as any).forEach((f) => (spec[`data.${f}`] = 1));
      c.createIndex(spec).catch(() => {});
    }
  }
  return c;
}
const toDoc = <T>(r: any): VibeDoc<T> => ({ id: String(r._id), data: r.data as T });

class Query<T> {
  constructor(private def: Def, private f: Record<string, unknown> = {}, private sort: Record<string, 1 | -1> = {}, private lim = 0, private after: string | null = null) {}
  private clone() { return new Query<T>(this.def, { ...this.f }, { ...this.sort }, this.lim, this.after); }
  where(field: string, op: string, value: unknown) {
    const q = this.clone();
    const k = `data.${field}`;
    const ops: Record<string, string> = { '!=': '$ne', '>': '$gt', '>=': '$gte', '<': '$lt', '<=': '$lte', in: '$in', 'not-in': '$nin' };
    if (op === '==') q.f[k] = value;
    else if (ops[op]) q.f[k] = { ...(q.f[k] as object ?? {}), [ops[op]!]: value };
    else throw new Error(`Operador não suportado: ${op}`);
    return q;
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') { const q = this.clone(); q.sort[`data.${field}`] = dir === 'desc' ? -1 : 1; return q; }
  limit(n: number) { const q = this.clone(); q.lim = n; return q; }
  startAfter(cursor: string | null) { const q = this.clone(); q.after = cursor; return q; }
  private async find() {
    const c = await coll(this.def);
    const f: Filter<Document> = { ...this.f };
    const sort = Object.keys(this.sort).length ? { ...this.sort, _id: 1 as const } : { _id: 1 as const };
    if (this.after) f._id = { $gt: this.after } as any;
    let cur = c.find(f).sort(sort);
    if (this.lim) cur = cur.limit(this.lim);
    return cur.toArray();
  }
  async get(): Promise<VibeDoc<T>[]> { return (await this.find()).map((r) => toDoc<T>(r)); }
  async getPage() {
    const rows = await this.find();
    const docs = rows.map((r) => toDoc<T>(r));
    const cursor = this.lim && rows.length === this.lim && !Object.keys(this.sort).length ? String(rows[rows.length - 1]!._id) : undefined;
    return { docs, cursor };
  }
  async count() { return (await coll(this.def)).countDocuments(this.f as Filter<Document>); }
  doc(id: string) {
    const def = this.def;
    return {
      id,
      async get(): Promise<VibeDoc<T> | null> { const r = await (await coll(def)).findOne({ _id: id as any }); return r ? toDoc<T>(r) : null; },
      async set(data: T) { await (await coll(def)).replaceOne({ _id: id as any }, { _id: id as any, data } as any, { upsert: true }); return { id, data }; },
      async update(patch: Partial<T>) {
        const $set: Record<string, unknown> = {};
        Object.entries(patch as object).forEach(([k, v]) => ($set[`data.${k}`] = v));
        if (Object.keys($set).length) await (await coll(def)).updateOne({ _id: id as any }, { $set });
        return { id };
      },
      async delete() { await (await coll(def)).deleteOne({ _id: id as any }); },
    };
  }
  async add(data: T): Promise<VibeDoc<T>> {
    const id = randomUUID();
    await (await coll(this.def)).insertOne({ _id: id as any, data } as any);
    return { id, data };
  }
}
export const db = { collection<T = any>(def: Def & { __t?: T }) { return new Query<T>(def); } };
