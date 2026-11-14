import { currentCtx } from './context';
import { gql } from './monday';

export async function getCurrentUser(): Promise<{ id: string; name: string; email: string } | null> {
  const ctx = currentCtx();
  if (!ctx?.userId) return null;
  const r = await gql<{ users: { id: string; name: string; email: string }[] }>('query ($ids: [ID!]) { users(ids: $ids) { id name email } }', { ids: [ctx.userId] });
  return r.users?.[0] ?? null;
}
