import { randomUUID } from 'node:crypto';
import type { Filter, Document, Sort } from 'mongodb';
import { mongo } from './mongo';

interface Coll { name: string }
export interface DocSnap<T> { id: string; data: T }

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

class DocRef<T> {
  constructor(private c: string, public id: string) {}
  private async col() { return (await mongo()).collection(this.c); }
  async get(): Promise<DocSnap<T> | null> {
    return strip(await (await this.col()).findOne({ _id: this.id } as Filter<Document>));
  }
  async set(data: T, opts?: { merge?: boolean }): Promise<void> {
    const col = await this.col();
    if (opts?.merge) await col.updateOne({ _id: this.id } as Filter<Document>, { $set: clean(data) }, { upsert: true });
    else await col.replaceOne({ _id: this.id } as Filter<Document>, clean(data), { upsert: true });
  }
  async update(data: Partial<T>): Promise<void> {
    const r = await (await this.col()).updateOne({ _id: this.id } as Filter<Document>, { $set: clean(data) });
    if (r.matchedCount === 0) throw new Error('Registro não encontrado.');
  }
  async delete(): Promise<void> {
    await (await this.col()).deleteOne({ _id: this.id } as Filter<Document>);
  }
}

class Query<T> {
  constructor(protected c: string, protected filter: Filter<Document> = {}, protected sort: Sort | null = null, protected lim = 0) {}
  where(field: string, op: string, value: unknown): Query<T> {
    const mop = OPS[op];
    if (!mop) throw new Error(`Operador não suportado: ${op}`);
    const key = field === 'id' ? '_id' : field;
    const prev = (this.filter as Document)[key];
    const cond = { ...(prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}), [mop]: value };
    return new Query<T>(this.c, { ...this.filter, [key]: cond }, this.sort, this.lim);
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Query<T> {
    return new Query<T>(this.c, this.filter, { ...((this.sort as object) ?? {}), [field]: dir === 'desc' ? -1 : 1 } as Sort, this.lim);
  }
  limit(n: number): Query<T> {
    return new Query<T>(this.c, this.filter, this.sort, n);
  }
  startAfter(cursor: string | null | undefined): Query<T> {
    if (!cursor) return this;
    return new Query<T>(this.c, { ...this.filter, _id: { $gt: cursor } } as Filter<Document>, this.sort, this.lim);
  }
  async getPage(): Promise<{ docs: DocSnap<T>[]; cursor: string | null }> {
    const lim = this.lim || 500;
    const col = (await mongo()).collection(this.c);
    const docs = (await col.find(this.filter).sort({ _id: 1 }).limit(lim).toArray()).map((d) => strip(d)!) as DocSnap<T>[];
    return { docs, cursor: docs.length === lim ? docs[docs.length - 1].id : null };
  }
  async get(): Promise<DocSnap<T>[]> {
    const col = (await mongo()).collection(this.c);
    let cur = col.find(this.filter);
    if (this.sort) cur = cur.sort(this.sort);
    if (this.lim) cur = cur.limit(this.lim);
    return (await cur.toArray()).map((d) => strip(d)!) as DocSnap<T>[];
  }
}

class CollRef<T> extends Query<T> {
  constructor(name: string) { super(name); }
  doc(id?: string): DocRef<T> { return new DocRef<T>(this.c, id ?? randomUUID()); }
  async add(data: T): Promise<{ id: string }> {
    const id = randomUUID();
    await (await mongo()).collection(this.c).insertOne({ _id: id, ...clean(data) } as Document);
    return { id };
  }
}

export const db = {
  collection<T>(c: Coll & { __t?: T }): CollRef<T> {
    return new CollRef<T>(c.name);
  },
};
