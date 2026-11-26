import { AsyncLocalStorage } from 'node:async_hooks';

export interface ReqCtx { userId: string; accountId: string; isAdmin: boolean; isGuest: boolean; viaCron?: boolean; callId?: string; encerrada?: boolean }
export const reqCtx = new AsyncLocalStorage<ReqCtx>();
export const currentCtx = () => reqCtx.getStore() ?? null;

/** Token OAuth da pessoa em nome de quem uma rotina em segundo plano está gravando. */
export const tokenAtual = new AsyncLocalStorage<string>();
