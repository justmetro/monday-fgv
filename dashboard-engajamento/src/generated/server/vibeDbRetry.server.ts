// Gravações no Vibe DB com tolerância a falhas momentâneas de conexão ("fetch failed").
const WAITS_MS = [400, 1200, 3000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(e: unknown): boolean {
  const msg = (e as Error)?.message?.toLowerCase() ?? '';
  return msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('timeout') || msg.includes('socket') || msg.includes('503') || msg.includes('502');
}

/** Gravação essencial: repete em falhas momentâneas e, se não der, lança uma mensagem amigável. */
export async function dbWriteWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const wait = WAITS_MS[attempt];
      if (!isTransient(e) || wait === undefined) {
        console.error(`Falha ao gravar no armazenamento do app (${label}).`);
        throw new Error('O armazenamento do app ficou indisponível por um instante. Tente novamente em alguns segundos.');
      }
      await sleep(wait);
    }
  }
}

/** Leitura essencial: repete em qualquer falha (servidor "frio", conexão instável) antes de desistir. */
export async function dbReadWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const wait = WAITS_MS[attempt];
      if (wait === undefined) {
        console.error(`Falha ao ler do armazenamento do app (${label}):`, (e as Error)?.message);
        throw new Error('Não foi possível ler a base do aplicativo agora.');
      }
      await sleep(wait);
    }
  }
}

/** Gravação acessória (ex.: registro de atividade): tenta de novo uma vez e nunca derruba a operação principal. */
export async function dbWriteBestEffort(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    try {
      await sleep(WAITS_MS[0] ?? 400);
      await fn();
    } catch {
      console.error(`Registro acessório não gravado (${label}).`);
    }
  }
}
