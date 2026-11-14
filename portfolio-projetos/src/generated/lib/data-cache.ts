// Cache local dos dados dos painéis (IndexedDB do navegador + memória da sessão).
// Os dados só são baixados de novo quando a "versão" (datas de atualização dos projetos) muda.

const DB = 'painel-dgpe-cache';
const STORE = 'datasets';
type Entry<T> = { version: string; data: T; savedAt: string };
const mem = new Map<string, Entry<unknown>>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function readCache<T>(key: string): Promise<Entry<T> | null> {
  const m = mem.get(key);
  if (m) return m as Entry<T>;
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => { const v = (req.result as Entry<T> | undefined) ?? null; if (v) mem.set(key, v); resolve(v); };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function writeCache<T>(key: string, version: string, data: T): Promise<void> {
  const e: Entry<T> = { version, data, savedAt: new Date().toISOString() };
  mem.set(key, e);
  const db = await open();
  if (!db) return;
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(e, key); } catch (err) { console.warn('[cache] não foi possível salvar', err); }
}
