// Chamada à IA (formato OpenAI). Modelos da monday consomem créditos de IA da conta;
// modelos Gemini usam a API do Google com a chave GEMINI_API_KEY do monday code;
// modelos do OpenRouter (gratuitos) usam a chave OPENROUTER_API_KEY.
import type { Prompt } from './prompts';

export const URL_IA = 'https://api.monday.com/platform-ai-gateway/openai/v1/chat/completions';
export const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

const ehGemini = (modelo: string) => /^gemini/.test(modelo);
const ehOpenRouter = (modelo: string) => modelo === 'openrouter/free' || /:free$/.test(modelo);
// Reservas do roteador gratuito: modelos :free com contexto de 1 milhão de tokens ou perto disso.
const RESERVAS_OPENROUTER = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'google/gemma-4-31b-it:free'];

function provedor(modelo: string) {
  if (ehGemini(modelo)) return { url: URL_GEMINI, chave: process.env.GEMINI_API_KEY, fonte: 'Gemini', variavel: 'GEMINI_API_KEY' };
  if (ehOpenRouter(modelo)) return { url: URL_OPENROUTER, chave: process.env.OPENROUTER_API_KEY, fonte: 'OpenRouter', variavel: 'OPENROUTER_API_KEY' };
  return null;
}

export const MODELOS = [
  { id: 'monday-standard', nome: 'Padrão da monday' },
  { id: 'gpt-5', nome: 'GPT-5' },
  { id: 'gpt-5-mini', nome: 'GPT-5 mini (mais barato)' },
  { id: 'gemini-3.5-flash', nome: 'Gemini 3.5 Flash (Google)' },
  { id: 'gemini-3.8-flash', nome: 'Gemini 3.8 Flash (Google)' },
  { id: 'openrouter/free', nome: 'OpenRouter gratuito (automático)' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', nome: 'Nemotron 3 Ultra (OpenRouter gratuito)' },
] as const;

export interface RespostaIA<T> { data: T; modelo: string; custo: number | null; tokensEntrada: number; tokensSaida: number; ms: number }

function extrairJson(texto: string): unknown {
  let t = texto.trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca) t = cerca[1].trim();
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini >= 0 && fim > ini) t = t.slice(ini, fim + 1);
  return JSON.parse(t);
}

export async function chamarIA<T = any>(prompt: Prompt, token: string, modelo = 'monday-standard'): Promise<RespostaIA<T>> {
  const inicio = Date.now();
  const gemini = ehGemini(modelo);
  const openrouter = ehOpenRouter(modelo);
  const ext = provedor(modelo);
  const chave = ext ? (ext.chave ?? '').trim() : token;
  if (ext && !chave) throw new Error(`A chave do ${ext.fonte} não está configurada no servidor (${ext.variavel}).`);
  const url = ext ? ext.url : URL_IA;
  const fonte = ext ? ext.fonte : 'IA da monday';
  const corpo: Record<string, unknown> = {
    model: modelo,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    // No Gemini o limite inclui o raciocínio interno, por isso a folga.
    max_tokens: gemini || openrouter ? Math.min(prompt.maxTokens + 16000, 65536) : prompt.maxTokens,
  };
  if (modelo === 'openrouter/free') corpo.models = ['openrouter/free', ...RESERVAS_OPENROUTER];
  if (!/^gpt/.test(modelo)) corpo.temperature = 0.2;
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= (gemini ? 5 : 3); tentativa++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${chave}`,
          ...(openrouter ? { 'X-Title': 'Hub de Planejamento FGV DGPE' } : {}),
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(15 * 60_000),
      });
    } catch (e) {
      ultimoErro = `sem resposta (${(e as Error).message})`;
      await new Promise((r) => setTimeout(r, 5000 * tentativa));
      continue;
    }
    let j: any = await res.json().catch(() => null);
    if (Array.isArray(j)) j = j[0];
    if (!res.ok) {
      ultimoErro = `${res.status}: ${String(j?.error?.message ?? j?.message ?? '').slice(0, 300)}`;
      if (openrouter && res.status === 429 && (tentativa >= 2 || /per-day|per day/i.test(ultimoErro))) {
        throw new Error('O limite gratuito do OpenRouter foi atingido (20 pedidos por minuto e 50 por dia). Espere um pouco ou troque o modelo de IA.');
      }
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, (gemini ? 20000 : 8000) * tentativa)); continue; }
      throw new Error(`${fonte} recusou o pedido (${ultimoErro}).`);
    }
    const texto: string = j?.choices?.[0]?.message?.content ?? '';
    const motivo = j?.choices?.[0]?.finish_reason;
    try {
      const data = extrairJson(texto) as T;
      return {
        data,
        modelo: String(j?.model ?? modelo),
        custo: typeof j?.usage?.cost === 'number' ? j.usage.cost : null,
        tokensEntrada: Number(j?.usage?.prompt_tokens ?? 0),
        tokensSaida: Number(j?.usage?.completion_tokens ?? 0),
        ms: Date.now() - inicio,
      };
    } catch {
      ultimoErro = motivo === 'length' ? 'a resposta passou do limite de tamanho' : 'a resposta não veio em JSON válido';
      if (motivo === 'length') corpo.max_tokens = Math.min(Number(corpo.max_tokens) * 2, 64000);
    }
  }
  throw new Error(`A IA não concluiu: ${ultimoErro}. Tente de novo.`);
}
