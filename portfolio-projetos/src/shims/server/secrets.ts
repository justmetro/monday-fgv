// Tokens pessoais ficam no SecureStorage do monday code (criptografado), nunca no banco.
import { SecureStorage } from '@mondaycom/apps-sdk';
let ss: InstanceType<typeof SecureStorage> | null = null;
const store = () => (ss ??= new SecureStorage());
const key = (userId: string) => `user_token_${userId}`;
export async function getUserToken(userId: string): Promise<string | null> {
  try { const v = await store().get<string>(key(userId)); return typeof v === 'string' ? v : null; } catch { return null; }
}
export async function setUserToken(userId: string, token: string) { await store().set(key(userId), token); }
export async function deleteUserToken(userId: string) { await store().delete(key(userId)); }
