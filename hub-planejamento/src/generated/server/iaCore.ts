// Chamada à IA da monday (gateway compatível com OpenAI). Consome créditos de IA da conta.
import type { Prompt } from './prompts';

export const URL_IA = 'https://api.monday.com/platform-ai-gateway/openai/v1/chat/completions';

export const MODELOS = [
  { id: 'monday-standard', nome: 'Padrão da monday' },
  { id: 'gpt-5', nome: 'GPT-5' },
  { id: 'gpt-5-mini', nome: 'GPT-5 mini (mais barato)' },
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
  const corpo: Record<string, unknown> = {
    model: modelo,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    max_tokens: prompt.maxTokens,
  };
  if (!/^gpt/.test(modelo)) corpo.temperature = 0.2;
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    let res: Response;
    try {
      res = await fetch(URL_IA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(15 * 60_000),
      });
    } catch (e) {
      ultimoErro = `sem resposta (${(e as Error).message})`;
      await new Promise((r) => setTimeout(r, 5000 * tentativa));
      continue;
    }
    const j: any = await res.json().catch(() => null);
    if (!res.ok) {
      ultimoErro = `${res.status}: ${String(j?.error?.message ?? j?.message ?? '').slice(0, 300)}`;
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 8000 * tentativa)); continue; }
      throw new Error(`IA da monday recusou o pedido (${ultimoErro}).`);
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
