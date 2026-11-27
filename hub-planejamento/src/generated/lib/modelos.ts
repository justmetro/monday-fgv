// Modelos de IA que o hub oferece (lista usada na tela e no servidor).
export const MODELOS = [
  { id: 'monday-standard', nome: 'Padrão da monday' },
  { id: 'gpt-5', nome: 'GPT-5' },
  { id: 'gpt-5-mini', nome: 'GPT-5 mini (mais barato)' },
  { id: 'gemini-3.5-flash', nome: 'Gemini 3.5 Flash (Google)' },
  { id: 'gemini-3.8-flash', nome: 'Gemini 3.8 Flash (Google)' },
  { id: 'openrouter/free', nome: 'OpenRouter gratuito (automático)' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', nome: 'Nemotron 3 Ultra (OpenRouter)' },
  { id: 'nvidia/nemotron-3.5-super-vl:free', nome: 'Nemotron 3.5 Super (OpenRouter)' },
  { id: 'nvidia/nemotron-3.5-lightning:free', nome: 'Nemotron 3.5 Lightning (OpenRouter)' },
  { id: 'baidu/ernie-5.5-flash-preview:free', nome: 'ERNIE 5.5 Flash (OpenRouter)' },
  { id: 'particle-ai/particle-1:free', nome: 'Particle 1 (OpenRouter)' },
  { id: 'google/gemma-4-31b-it:free', nome: 'Gemma 4 31B (OpenRouter)' },
] as const;

export const nomeModelo = (id?: string | null) => MODELOS.find((m) => m.id === id)?.nome ?? id ?? '';

/** Fonte de crédito de cada modelo: trocar dentro da mesma fonte não resolve falta de crédito. */
export const fonteModelo = (id: string) => (/^gemini/.test(id) ? 'google' : id === 'openrouter/free' || /:free$/.test(id) ? 'openrouter' : 'monday');
