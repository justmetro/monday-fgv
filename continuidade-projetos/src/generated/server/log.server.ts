import { DecisoesDoVibeBoard } from '@api/BoardSDK';
import { getCurrentUser } from '@api/current-user.server';
import { CAMPOS, fmtValor, type LogEntry, type Mudanca } from '@generated/lib/logCampos';

const MARK = '#LOG-PAINEL:';
const RE = /#LOG-PAINEL:([A-Za-z0-9+/=]+)/;

type Payload = Omit<LogEntry, 'id' | 'itemId'>;

function toB64(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): string {
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Item do quadro Continuidade – Decisões ligado ao projeto (cria se não existir). */
export async function garantirItemDecisao(projectId: string, projectName: string, decisionId?: string | null): Promise<string> {
  if (decisionId) return decisionId;
  const board = new DecisoesDoVibeBoard();
  const found = await board.items().withColumns(['projeto']).where({ projeto: { itemId: projectId } }).withPagination({ limit: 1 }).execute();
  const existing = found?.items?.[0];
  if (existing) return String(existing.id);
  const created = await board.item().create({ name: projectName, projeto: { linkedItems: [{ id: projectId }] } }).execute();
  return String(created.id);
}

export async function usuarioAtual(): Promise<string> {
  try {
    const u = await getCurrentUser();
    return u?.name || 'Usuário desconhecido';
  } catch (e) {
    console.error('usuarioAtual', e);
    return 'Usuário desconhecido';
  }
}

/** Publica o registro como update no item do quadro C (texto legível + dados codificados para reversão). */
export async function publicarLog(itemId: string, p: Payload): Promise<LogEntry> {
  const quando = new Date(p.at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const titulo = p.acao === 'reversao' ? `${p.user} reverteu alterações em ${quando}` : `${p.user} alterou ${p.changes.length} campo(s) em ${quando}`;
  const linhas = p.changes.map((c: Mudanca) => `• ${CAMPOS[c.campo].label}: ${fmtValor(c.campo, c.de)} → ${fmtValor(c.campo, c.para)}`);
  const codigo = toB64(JSON.stringify(p));
  const body = [`<p><strong>[Histórico do painel]</strong> ${esc(titulo)}</p>`, ...linhas.map((l) => `<p>${esc(l)}</p>`), `<p>${MARK}${codigo}</p>`].join('');
  const res = await new DecisoesDoVibeBoard().item(itemId).post().create(body).execute();
  const id = res && typeof res === 'object' && 'id' in res ? String((res as { id: unknown }).id) : `${itemId}-${Date.now()}`;
  return { ...p, id, itemId };
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function decodificar(update: unknown, itemId: string): LogEntry | null {
  if (!update || typeof update !== 'object') return null;
  const u = update as { id?: unknown; text_body?: unknown; body?: unknown };
  const txt = `${typeof u.text_body === 'string' ? u.text_body : ''} ${typeof u.body === 'string' ? u.body : ''}`;
  const m = RE.exec(txt);
  if (!m?.[1]) return null;
  try {
    const p = JSON.parse(fromB64(m[1])) as Payload;
    if (!p || !Array.isArray(p.changes) || !p.projectId) return null;
    return { ...p, ref: p.ref ?? null, id: String(u.id ?? ''), itemId };
  } catch {
    return null;
  }
}
