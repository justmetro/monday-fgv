// Código só de servidor: no navegador nunca é executado.
const fail = () => { throw new Error('server-only'); };
export const db: any = new Proxy({}, { get: () => fail });
export type VibeDoc<T> = { id: string; data: T };
export const getCurrentUser = fail;
export default fail;
export const executeAiRequest = fail;
export function defineCollection<T>(def: { name: string; indexes?: unknown[] }) { return def as { name: string; indexes?: unknown[]; __t?: T }; }
export const getUserToken = fail;
export const setUserToken = fail;
export const deleteUserToken = fail;
