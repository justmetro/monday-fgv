// Mesma interface do @vibe/db/server (estilo Firestore), sobre o Document DB do monday code.
import { randomUUID } from 'node:crypto';
import type { Filter, Document } from 'mongodb';
import { mongo } from './mongo';

interface Coll { name: string }
export interface DocSnap<T> { id: string; data: T }
export type VibeDoc<T> = DocSnap<T>;

const OPS: Record<string, string> = { '==': '$eq', '!=': '$ne', '>': '$gt', '>=': '$gte', '<': '$lt', '<=': '$lte', in: '$in', 'not-in': '$nin' };

function strip(d: Document | null): DocSnap<any> | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { id: String(_id), data: rest };
}
function clean<T>(data: T): Document {
  const out = { ...(data as Document) };
  delete out._id;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const dec = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { v: unknown[]; id: string };

class DocRef<T> {
  constructor(private c: string, public id: string) {}
  private async col() { return (await mongo()).collection(this.c); }
  async get(): Promise<DocSnap<T> | null> {
    return strip(await (await this.col()).findOne({ _id: this.id } as Filter<Document>));
  }
  async set(data: T, opts?: { merge?: boolean }): Promise<DocSnap<T>> {
    const col = await this.col();
    if (opts?.merge) await col.updateOne({ _id: this.id } as Filter<Document>, { $set: clean(data) }, { upsert: true });
    else await col.replaceOne({ _id: this.id } as Filter<Document>, clean(data), { upsert: true });
    return (await this.get()) ?? { id: this.id, data };
  }
  async update(data: Partial<T>): Promise<DocSnap<T>> {
    const col = await this.col();
    const r = await col.findOneAndUpdate({ _id: this.id } as Filter<Document>, { $set: clean(data) }, { returnDocument: 'after' });
    if (!r) throw new Error('Registro não encontrado.');
    return strip(r) as DocSnap<T>;
  }
  async delete(): Promise<void> {
    await (await this.col()).deleteOne({ _id: this.id } as Filter<Document>);
  }
}

type Ord = [string, 1 | -1][];

class Query<T> {
  constructor(protected c: string, protected filter: Filter<Document> = {}, protected ord: Ord = [], protected lim = 0, protected after: string | null = null) {}
  where(field: string, op: string, value: unknown): Query<T> {
    const mop = OPS[op];
    if (!mop) throw new Error(`Operador não suportado: ${op}`);
    const key = field === 'id' ? '_id' : field;
    const prev = (this.filter as Document)[key];
    const cond = { ...(prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}), [mop]: value };
    return new Query<T>(this.c, { ...this.filter, [key]: cond }, this.ord, this.lim, this.after);
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Query<T> {
    return new Query<T>(this.c, this.filter, [...this.ord, [field === 'id' ? '_id' : field, dir === 'desc' ? -1 : 1]], this.lim, this.after);
  }
  limit(n: number): Query<T> {
    return new Query<T>(this.c, this.filter, this.ord, n, this.after);
  }
  startAfter(cursor: string | null | undefined): Query<T> {
    return new Query<T>(this.c, this.filter, this.ord, this.lim, cursor || null);
  }
  private sortSpec(): Ord {
    return this.ord.some(([f]) => f === '_id') ? this.ord : [...this.ord, ['_id', 1]];
  }
  /** Filtro "depois do cursor" para a ordenação composta (campos + _id). */
  private afterFilter(): Filter<Document> {
    if (!this.after) return this.filter;
    const { v, id } = dec(this.after);
    const spec = this.sortSpec();
    const vals = [...v, id];
    const ors: Document[] = spec.map((_, i) => {
      const o: Document = {};
      for (let j = 0; j < i; j++) o[spec[j][0]] = vals[j];
      o[spec[i][0]] = { [spec[i][1] === 1 ? '$gt' : '$lt']: vals[i] };
      return o;
    });
    return { $and: [this.filter, { $or: ors }] } as Filter<Document>;
  }
  async getPage(): Promise<{ docs: DocSnap<T>[]; cursor: string | null }> {
    const lim = this.lim || 500;
    const col = (await mongo()).collection(this.c);
    const spec = this.sortSpec();
    const raw = await col.find(this.afterFilter()).sort(Object.fromEntries(spec)).limit(lim).toArray();
    const docs = raw.map((d) => strip(d)!) as DocSnap<T>[];
    let cursor: string | null = null;
    if (raw.length === lim) {
      const last = raw[raw.length - 1];
      cursor = enc({ v: spec.filter(([f]) => f !== '_id').map(([f]) => last[f] ?? null), id: String(last._id) });
    }
    return { docs, cursor };
  }
  async get(): Promise<DocSnap<T>[]> {
    const col = (await mongo()).collection(this.c);
    let cur = col.find(this.afterFilter());
    if (this.ord.length) cur = cur.sort(Object.fromEntries(this.ord));
    if (this.lim) cur = cur.limit(this.lim);
    return (await cur.toArray()).map((d) => strip(d)!) as DocSnap<T>[];
  }
  async count(): Promise<number> {
    return (await mongo()).collection(this.c).countDocuments(this.filter);
  }
  aggregate() {
    const c = this.c, filter = this.filter;
    return {
      groupBy: (field: string) => ({
        count: async (): Promise<{ key: unknown; count: number }[]> => {
          const rows = await (await mongo()).collection(c).aggregate([{ $match: filter }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]).toArray();
          return rows.map((r) => ({ key: r._id, count: r.count as number }));
        },
      }),
    };
  }
}

class CollRef<T> extends Query<T> {
  constructor(name: string) { super(name); }
  doc(id?: string): DocRef<T> { return new DocRef<T>(this.c, id ?? randomUUID()); }
  async add(data: T): Promise<DocSnap<T>> {
    const id = randomUUID();
    const doc = clean(data);
    await (await mongo()).collection(this.c).insertOne({ _id: id, ...doc } as Document);
    return { id, data: doc as T };
  }
}

export const db = {
  collection<T>(c: Coll & { __t?: T }): CollRef<T> {
    return new CollRef<T>(c.name);
  },
};
