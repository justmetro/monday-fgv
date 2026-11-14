import { useState } from 'react';
import { AlertCircle, AlertTriangle, Archive, FileUp, Loader2 } from 'lucide-react';
import { RewriteConfirmModal, type ExistingWeek } from './RewriteConfirmModal';
import { getWeekPreviewContext } from '@generated/server/mirror';
import { buildLegacyPlan, type LegacyPlan } from '@generated/lib/legacyBase';
import { readXlsxFirstSheetNamed } from '@generated/lib/xlsxReader';
import { readCsvAsSheet } from '@generated/lib/legacyCsv';
import { WEEKDAYS } from '@generated/lib/weekdays';
import { periodError } from '@generated/lib/weekPeriod';
import { WeekPeriodFields } from './WeekPeriodFields';
import type { UploadSettings } from '@generated/hooks/usePanelUploadRunner';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;

interface Props {
  token: string;
  clientClaim: Claim;
  running: boolean;
  readSettings: () => ({ ok: true } & UploadSettings) | { ok: false; message: string };
  onStart: (args: { groupName: string; analysisDate: string; weekStart: string; weekEnd: string; fileName: string; plan: LegacyPlan; settings: UploadSettings; rewriteBefore?: { people: number; checks: number; boardItems: number | null } }) => Promise<string | null>;
}

interface Preview { plan: LegacyPlan; boardName: string | null; boardError: string | null; groupExists: boolean; existing: ExistingWeek | null }

const inputCls = 'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';
const br = (iso: string) => iso.split('-').reverse().join('/');

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-muted/50 border border-border p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums truncate" title={String(value)}>{value}</p>
    </div>
  );
}

/** Base antiga (XLSX do formato antigo): só dono, admin e PMO. Mesmo token, quadro, lotes e histórico do envio normal. */
export function LegacyBaseSection({ token, clientClaim, running, readSettings, onStart }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState('');
  const [analysisDate, setAnalysisDate] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const locked = running || busy;
  const reset = () => { setPreview(null); setMessage(null); };

  const makePreview = async () => {
    setMessage(null);
    if (!token.trim()) return setMessage('Informe o token da API do monday (campo do envio normal, acima).');
    if (!file) return setMessage('Escolha o arquivo CSV ou XLSX.');
    const isCsv = /\.csv$/i.test(file.name);
    if (!isCsv && !/\.xlsx$/i.test(file.name)) return setMessage('Formato não aceito: use .csv ou .xlsx.');
    if (!groupName.trim()) return setMessage('Informe o nome do grupo.');
    if (!analysisDate) return setMessage('Informe a data da análise.');
    const pErr = periodError(weekStart, weekEnd);
    if (pErr) return setMessage(pErr);
    setBusy(true);
    try {
      const [ctx, sheet] = await Promise.all([
        getWeekPreviewContext({ data: { token: token.trim(), groupName: groupName.trim(), analysisDate, clientClaim } }),
        isCsv ? readCsvAsSheet(file) : readXlsxFirstSheetNamed(file),
      ]);
      // Grupo que já existe (Base ou quadro) = reescrita da semana: o plano é calculado como semana nova
      const inBoard = Boolean(ctx.board?.groupExists);
      const exists = ctx.baseRows.length > 0 || Boolean(ctx.weekRange) || inBoard;
      const existing: ExistingWeek | null = exists
        ? {
            people: ctx.baseRows.length,
            checks: ctx.baseRows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0),
            boardItems: ctx.board?.groupItems ?? null,
            inBoard,
            validated: ctx.weekStatus === 'validada',
          }
        : null;
      const built = buildLegacyPlan(sheet.rows, { name: sheet.name, count: sheet.sheetCount }, analysisDate, { weekStart, weekEnd }, groupName.trim(), exists ? [] : ctx.baseRows, ctx.board?.columns ?? null, sheet.links, sheet.cells, ctx.reference);
      if (!built.ok) {
        setPreview(null);
        const d = sheet.debug;
        setMessage(built.message.startsWith('Muitas linhas sem e-mail')
          ? `${built.message} || XML cru da célula A3: ${d.cellXml('A3')} || Tabela de textos: ${d.sharedStringsName} (${d.sharedStringsBytes} caracteres, ${d.sharedStringsCount} textos) · aba lida: ${d.sheetPath} || Arquivos no .xlsx: ${d.files.map((f) => `${f.name} (${f.size} bytes)`).join(', ')}`
          : built.message);
        return;
      }
      setPreview({ plan: built.plan, boardName: ctx.board?.name ?? null, boardError: ctx.boardError, groupExists: inBoard, existing });
    } catch (e) {
      setPreview(null);
      setMessage((e as Error).message || 'Não foi possível gerar a prévia.');
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!preview || !file) return;
    const s = readSettings();
    if (!s.ok) { setAsk(false); return setMessage(s.message); }
    setMessage(null);
    const ex = preview.existing;
    const blocked = await onStart({
      groupName: groupName.trim(), analysisDate, weekStart, weekEnd, fileName: file.name, plan: preview.plan,
      settings: { itemsPerCall: s.itemsPerCall, parallelCalls: s.parallelCalls },
      ...(ex ? { rewriteBefore: { people: ex.people, checks: ex.checks, boardItems: ex.boardItems } } : {}),
    });
    setAsk(false);
    if (blocked) setMessage(blocked);
    else setPreview(null);
  };

  const p = preview?.plan;
  const ex = preview?.existing ?? null;
  const afterChecks = p ? p.rows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0) : 0;
  const blockedReason = !preview ? null
    : p && !p.sumOk ? `A soma não fecha: ${p.rowsRead} lidas ≠ ${p.discarded} descartadas por status + ${p.noIdentification} sem identificação + ${p.duplicatesInFile} duplicadas + ${p.notInReference} fora da análise mais recente + ${p.rows.length} entram. Nada será gravado.`
    : p && p.missingDayColumns.length > 0 ? `Faltam colunas de check no quadro: ${p.missingDayColumns.join(', ')}. Nada será gravado.`
    : p && p.rows.length === 0 ? 'Nenhuma linha para gravar.' : null;

  return (
    <section className="bg-card rounded-3xl soft-stack-card border border-border p-5 sm:p-7 space-y-5">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-muted text-foreground grid place-items-center shrink-0"><Archive className="w-5 h-5" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Base antiga</p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Subir semanas do formato antigo (CSV ou XLSX)</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Usa o token acima e o mesmo quadro. No formato novo entra só “Ativado”; no antigo descarta só “Deactivated - No Access”. E-mail e nome são identificados pelo conteúdo das colunas. A semana é o período digitado (domingo a sábado). Estes envios ficam marcados como base antiga e não entram no score geral.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="space-y-1.5 text-[11px] font-medium text-foreground">
          <span className="flex items-center gap-1"><FileUp className="w-3 h-3" /> Arquivo CSV ou XLSX</span>
          <input type="file" accept=".csv,.xlsx" disabled={locked} onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }}
            className={`${inputCls} py-2 file:mr-2 file:rounded-full file:border-0 file:bg-muted file:px-3 file:text-xs`} />
        </label>
        <label className="space-y-1.5 text-[11px] font-medium text-foreground">
          <span>Nome do grupo</span>
          <input value={groupName} maxLength={255} disabled={locked} onChange={(e) => { setGroupName(e.target.value); reset(); }} className={inputCls} placeholder="Ex.: Semana 12" />
        </label>
        <label className="space-y-1.5 text-[11px] font-medium text-foreground">
          <span>Data da análise</span>
          <input type="date" value={analysisDate} disabled={locked} onChange={(e) => { setAnalysisDate(e.target.value); reset(); }} className={inputCls} />
        </label>
        <WeekPeriodFields idPrefix="lg" weekStart={weekStart} weekEnd={weekEnd} disabled={locked} onChange={(p) => { setWeekStart(p.weekStart); setWeekEnd(p.weekEnd); reset(); }} />
      </div>

      {message ? (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2 break-words"><AlertCircle className="w-4 h-4 shrink-0" /> {message}</p>
      ) : null}

      {!preview && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void makePreview()} disabled={locked} className="h-11 px-5 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Gerar prévia da base antiga
          </button>
        </div>
      )}

      {preview && p ? (
        <div className="space-y-4 border-t border-border pt-4">
          {ex ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs space-y-1.5" role="alert">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> A {groupName.trim()} já existe e será reescrita</p>
              <p className="text-foreground"><strong>Hoje:</strong> {ex.people} pessoas e {ex.checks} checks na Base · {ex.inBoard ? `${ex.boardItems ?? '?'} itens no grupo do quadro` : 'sem grupo no quadro'}{ex.validated ? ' · semana validada' : ''}</p>
              <p className="text-foreground"><strong>Depois (arquivo):</strong> {p.rows.length} pessoas e {afterChecks} checks · período {br(p.range.weekStart)} a {br(p.range.weekEnd)}</p>
              <p className="text-muted-foreground">Só essa semana é apagada e regravada. O estado de validação continua como está.</p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat label="Tipo de arquivo" value={file && /\.csv$/i.test(file.name) ? 'CSV' : 'XLSX'} />
            <Stat label="Aba lida" value={`${p.sheetName}${p.sheetCount > 1 ? ` (1ª de ${p.sheetCount})` : ''}`} />
            <Stat label="Grupo" value={`${groupName.trim()} · ${preview.boardName ? (preview.groupExists ? 'existente' : 'novo') : '—'}`} />
            <Stat label="Período digitado" value={`${br(p.range.weekStart)} a ${br(p.range.weekEnd)}`} />
            <Stat label="Data da análise" value={br(analysisDate)} />
            <Stat label="Linhas lidas" value={p.rowsRead} />
            <Stat label="Descartadas por status" value={p.discarded} />
            <Stat label="Sem identificação" value={p.noIdentification} />
            <Stat label="Duplicadas no arquivo" value={p.duplicatesInFile} />
            <Stat label="Fora da análise mais recente" value={p.notInReference} />
            <Stat label="Entram" value={p.rows.length} />
            <Stat label="A criar" value={p.toCreate} />
            <Stat label="A atualizar" value={p.toUpdate} />
            <Stat label="Sem alteração" value={p.unchanged} />
            <Stat label="Com Criado em" value={p.createdAtFilled} />
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
            <p className={p.sumOk ? 'text-foreground' : 'text-destructive'}>
              <strong>Soma conferida:</strong> {p.rowsRead} lidas = {p.discarded} descartadas por status + {p.noIdentification} sem identificação + {p.duplicatesInFile} duplicadas + {p.notInReference} não estão na análise mais recente + {p.rows.length} entram {p.sumOk ? '✓ fecha' : '✗ não fecha'}
            </p>
            <p>
              <strong className="text-foreground">Semana de referência:</strong> {p.reference.group} ({br(p.reference.weekStart)} a {br(p.reference.weekEnd)}) · {p.reference.people} pessoas. Só entra quem está nela.
            </p>
            <p><strong className="text-foreground">Formato detectado:</strong> status {p.statusFormat === 'novo' ? 'novo (“Ativado” / “Desativado - ...”): entra só “Ativado”' : 'antigo: descarta só “Deactivated - No Access”'}</p>
            <p><strong className="text-foreground">E-mail lido da coluna</strong> {p.emailColumn} · <strong className="text-foreground">nome lido da coluna</strong> {p.nameColumn}</p>
            <p><strong className="text-foreground">Proporção de “@” por candidata:</strong> {p.candidateStats.map((c) => `${c.letter} “${c.header}” ${Math.round(c.ratio * 100)}% (${c.role})`).join(' · ')}</p>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full max-w-xl">
                <thead><tr className="text-left"><th className="pr-3 pb-1 font-medium">Status</th><th className="pr-3 pb-1 font-medium">Lidas</th><th className="pr-3 pb-1 font-medium">Entram</th><th className="pb-1 font-medium">Saem</th></tr></thead>
                <tbody>{Object.entries(p.statusRead).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
                  <tr key={st} className="border-t border-border/60 text-foreground"><td className="pr-3 py-1">{st}</td><td className="pr-3 py-1 tabular-nums">{n}</td><td className="pr-3 py-1 tabular-nums">{p.byStatus[st] ?? 0}</td><td className="py-1 tabular-nums">{n - (p.byStatus[st] ?? 0)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-3 min-w-0">
            <div className="rounded-xl border border-border p-3 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">5 primeiras linhas lidas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="text-left text-muted-foreground">{['E-mail', 'Nome', 'Status antigo', 'Ativo pela última vez', 'Equipe', 'Criado em'].map((h) => <th key={h} className="pr-3 pb-1 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>{p.firstRows.map((r, i) => (
                    <tr key={i} className="border-t border-border/60 text-foreground">
                      <td className="pr-3 py-1 whitespace-nowrap">{r.email || '(vazio)'}</td><td className="pr-3 py-1 whitespace-nowrap">{r.name || '(vazio)'}</td>
                      <td className="pr-3 py-1 whitespace-nowrap">{r.status || '(vazio)'}</td><td className="pr-3 py-1 whitespace-nowrap">{r.lastAccess ? br(r.lastAccess) : '—'}</td>
                      <td className="pr-3 py-1 max-w-[200px] truncate" title={r.team}>{r.team || '—'}</td><td className="pr-3 py-1 whitespace-nowrap">{r.createdAt ? br(r.createdAt) : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-border p-3 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">10 primeiras pessoas que entram</p>
              <ol className="text-[11px] text-foreground space-y-0.5 list-decimal pl-4">
                {p.firstEntrants.map((r, i) => <li key={i} className="truncate">{r.email || '(sem e-mail)'} · {r.name}</li>)}
              </ol>
            </div>
          </div>
          <div className="rounded-xl border border-border p-3 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">10 exemplos de pessoas que ficaram de fora ({p.notInReference} no total)</p>
            {p.notInReferenceSamples.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Ninguém ficou de fora.</p>
            ) : (
              <ol className="text-[11px] text-foreground space-y-0.5 list-decimal pl-4">
                {p.notInReferenceSamples.map((r, i) => <li key={i} className="truncate">{r.email || '(sem e-mail)'} · último acesso {r.lastAccess ? br(r.lastAccess) : '—'}</li>)}
              </ol>
            )}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
            <p><strong className="text-foreground">Checks por dia:</strong> {WEEKDAYS.map((w) => `${w.short} (${p.checksByWeekday[w.key]})`).join(', ')}</p>
            <p>Acessos dentro da semana: {p.inWeek} · marcados em Sábado (depois do fim da semana, até a Data da análise): {p.afterWeekSaturday} · sem check: {p.noCheck} (sem último acesso: {p.noLastAccess}) · equipe preenchida: {p.teamFilled}{p.duplicatesInFile > 0 ? ` · repetidos no arquivo (ignorados): ${p.duplicatesInFile}` : ''}</p>
            {p.analysisBeforeWeekEnd ? <p className="text-foreground"><strong>Atenção:</strong> a Data da análise ({br(analysisDate)}) é anterior ao fim da semana ({br(p.range.weekEnd)}). Nenhum acesso será contado como “depois do fim da semana”.</p> : null}
            <p>Colunas ignoradas: {p.ignoredHeaders.join(', ') || 'nenhuma'}{p.boardHasCreatedAt === false ? ' · o quadro não tem a coluna “Criado em”: a data fica só na Base' : ''}</p>
          </div>
          {preview.boardError ? <p className="text-xs text-foreground bg-muted/60 rounded-xl p-3 break-words">Quadro indisponível agora ({preview.boardError}). A Base será gravada e o envio ao quadro ficará na fila da semana.</p> : null}
          {blockedReason ? <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl p-3">{blockedReason}</p> : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={reset} disabled={running} className="h-11 px-4 rounded-full border border-border text-xs hover:bg-muted disabled:opacity-50">Descartar prévia</button>
            <button type="button" onClick={() => (ex ? setAsk(true) : void confirm())} disabled={running || Boolean(blockedReason)} className="h-11 px-5 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {ex ? 'Confirmar reescrita e gravar' : 'Confirmar e gravar base antiga'} ({p.rows.length} pessoas)
            </button>
          </div>
        </div>
      ) : null}
      {ask && ex && p ? (
        <RewriteConfirmModal group={groupName.trim()} existing={ex} after={{ people: p.rows.length, checks: afterChecks }} busy={running} onCancel={() => setAsk(false)} onConfirm={() => void confirm()} />
      ) : null}
    </section>
  );
}
