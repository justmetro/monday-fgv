import type { EngagementSnapshotView } from '@generated/server/storage';

/**
 * Cópia local (neste navegador) da última base lida com sucesso, por usuário e visão.
 * Usada só quando a leitura da base falha na abertura, para nunca mostrar "sem base".
 * Usa IndexedDB (sem limite apertado de tamanho). Só chamar em efeitos/handlers.
 */
const DB_NAME = 'engajamento-hub-cache';
const STORE = 'snapshots';

export function snapshotCacheKey(email: string, viewAs?: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e) return null; // Sem usuário identificado não guarda nem lê cópia
  return `v1:${e}:${(viewAs ?? '').trim().toLowerCase()}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readCachedSnapshot(key: string): Promise<EngagementSnapshotView | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as EngagementSnapshotView | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeCachedSnapshot(key: string, snapshot: EngagementSnapshotView): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllCachedSnapshots(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
