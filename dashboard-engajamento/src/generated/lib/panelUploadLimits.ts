// Limites e padrões da gravação da aba "Atualizar Painel" (constantes únicas, usadas na tela e no servidor)
export const ITEMS_PER_CALL_MIN = 1;
export const ITEMS_PER_CALL_MAX = 100;
export const ITEMS_PER_CALL_DEFAULT = 25;
export const PARALLEL_CALLS_MIN = 1;
export const PARALLEL_CALLS_MAX = 5;
export const PARALLEL_CALLS_DEFAULT = 2;

export const RETRY_WAITS_MS = [2000, 4000, 8000]; // até 3 novas tentativas por chamada
export const RUN_TIME_LIMIT_MS = 10 * 60 * 1000;
export const MAX_CONSECUTIVE_FAILED_BATCHES = 3;

// Espelho no quadro: poucos itens por chamada para não estourar a complexidade do monday
export const MIRROR_ITEMS_PER_CALL_MAX = 25;
export const MIRROR_ROUNDS = 4; // rodadas de envio + conferência por fase

/** Espera sugerida pelo monday em erros de complexidade/limite ("reset in 23 seconds"). */
export function suggestedWaitMs(message: string): number | null {
  const m = message.match(/(\d+)\s*(seconds|second|segundos)/i);
  if (!m) return null;
  const s = Number(m[1]);
  return Number.isFinite(s) && s > 0 && s <= 90 ? s * 1000 + 500 : null;
}

export function clampInt(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}
