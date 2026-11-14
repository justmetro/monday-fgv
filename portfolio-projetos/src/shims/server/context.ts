import { AsyncLocalStorage } from 'node:async_hooks';
export type User = { id: string; name: string; kind: 'user' | 'system' | 'guest'; accountId?: string; isAdmin?: boolean };
export const als = new AsyncLocalStorage<{ user: User | null }>();
export const currentUser = () => als.getStore()?.user ?? null;
