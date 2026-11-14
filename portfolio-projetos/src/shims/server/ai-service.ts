// IA pela plataforma da monday (Models API, compatível com OpenAI). Consome créditos de IA da conta.
import { currentUser } from './context';
import { getUserToken } from './secrets';
const URL_AI = 'https://api.monday.com/platform-ai-gateway/openai/v1/chat/completions';
export async function executeAiRequest(prompt: string, opts: { schema?: object; systemPrompt?: string; model?: string } = {}) {
  const u = currentUser();
  const token = u ? await getUserToken(u.id) : null;
  if (!token) throw new Error('Para usar a IA, cadastre o seu token pessoal na tela Importação e atualização.');
  const sys = [opts.systemPrompt ?? '', opts.schema ? `Responda SOMENTE com um JSON válido que siga este JSON Schema, sem texto fora do JSON:\n${JSON.stringify(opts.schema)}` : ''].filter(Boolean).join('\n\n');
  const body: Record<string, unknown> = {
    model: opts.model ?? 'monday-standard',
    messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content: prompt }],
  };
  if (opts.schema) body.response_format = { type: 'json_object' };
  const res = await fetch(URL_AI, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`IA da monday indisponível (${res.status}): ${String(j?.error?.message ?? j?.message ?? '').slice(0, 200)}`);
  const text: string = j?.choices?.[0]?.message?.content ?? '';
  if (!opts.schema) return { data: text, text };
  const m = text.match(/\{[\s\S]*\}/);
  try { return { data: JSON.parse(m ? m[0] : text), text }; } catch { throw new Error('A resposta da IA não veio em JSON válido. Tente novamente.'); }
}
