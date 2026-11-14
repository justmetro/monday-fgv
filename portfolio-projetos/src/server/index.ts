// Servidor do Portfólio de Projetos no monday code: arquivos do app, funções de servidor e rotina diária.
import express from 'express';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '@shims/server/react-start';
import { als, type User } from '@shims/server/context';
// Registra todas as funções de servidor.
import '@generated/server/daily';
import '@generated/server/history';
import '@generated/server/importer';
import '@generated/server/intel';
import '@generated/server/pauta';
import '@generated/server/token';
import { claimDailyRun, finishDailyRun, reportDailyProject } from '@generated/server/daily';
import { stagedRefresh } from '@generated/components/import/stagedRefresh';

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

function userFrom(req: express.Request): User | null {
  const token = req.headers.authorization;
  const secret = process.env.CLIENT_SECRET;
  if (!token || !secret) return null;
  try {
    const p = jwt.verify(token, secret) as { dat?: { user_id?: number | string; account_id?: number | string; is_admin?: boolean; user_kind?: string } };
    if (!p?.dat?.user_id) return null;
    return { id: String(p.dat.user_id), name: '', kind: 'user', accountId: String(p.dat.account_id ?? ''), isAdmin: !!p.dat.is_admin };
  } catch { return null; }
}

app.post('/_fn/:id', async (req, res) => {
  const user = userFrom(req);
  if (!user) { res.status(401).json({ ok: false, error: 'Sessão não identificada. Abra o aplicativo dentro da monday.' }); return; }
  const fn = registry.get(req.params.id);
  if (!fn) { res.status(404).json({ ok: false, error: `Função desconhecida: ${req.params.id}` }); return; }
  try {
    const result = await als.run({ user }, () => fn(req.body?.data ?? undefined));
    res.json({ ok: true, result: result ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
    console.error('[fn]', req.params.id, msg);
    res.json({ ok: false, error: msg });
  }
});

// Rotina diária: chamada pelo agendador do monday code (dias úteis, madrugada).
let dailyRunning = false;
app.post('/mndy-cronjob/daily', async (req, res) => {
  if (!process.env.CRON_KEY || req.query.k !== process.env.CRON_KEY) { res.status(403).end(); return; }
  res.json({ ok: true, started: !dailyRunning });
  if (dailyRunning) return;
  dailyRunning = true;
  const user: User = { id: process.env.CRON_USER_ID ?? 'app', name: 'Rotina diária', kind: 'system' };
  try {
    await als.run({ user }, async () => {
      const c = await claimDailyRun({ data: {} });
      if (!c?.run) return;
      for (const p of c.projects) {
        let r: { ok: boolean; summary: string };
        try {
          const x = await stagedRefresh(p);
          r = { ok: x.ok && (!x.history || x.history.ok), summary: `${x.summary}${x.history ? ` · Cadastro: ${x.history.summary}` : ''}` };
        } catch (e) { r = { ok: false, summary: e instanceof Error ? e.message.slice(0, 500) : 'Falha na atualização.' }; }
        await reportDailyProject({ data: { id: c.id, boardId: p.boardId, name: p.name, ok: r.ok, summary: r.summary.slice(0, 3900) || '—' } }).catch((e) => console.error(e));
      }
      await finishDailyRun({ data: { id: c.id } });
    });
  } catch (e) { console.error('[rotina diária]', e); } finally { dailyRunning = false; }
});

app.get('/health', (_req, res) => { res.json({ ok: true }); });
app.use(express.static(path.join(dir, 'public'), { index: 'index.html' }));
const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`Portfólio ouvindo na porta ${port}`));
