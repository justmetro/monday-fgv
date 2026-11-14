import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Download, FileUp, Loader2, RefreshCw, Trash2, AlertTriangle, CheckCircle2, CalendarRange, Table2 } from 'lucide-react';
import type { UserSessionInfo } from '@generated/server/storage';
import { clearBaseData, getBaseData, reprocessWeekChecks, setWeekValidation, updateBaseRows } from '@generated/server/baseManagement';
import { deleteWeek, reopenWeek, setWeekPeriods } from '@generated/server/weekActions';
import type { StoredEngagementRow } from '@generated/models';
import { clearAllCachedSnapshots } from '@generated/lib/snapshotCache';
import { normText } from '@generated/lib/weekdays';
import { mirrorEditedRows } from '@generated/server/baseEditMirror';
import { BaseSyncPanel } from './base/BaseSyncPanel';
import { BaseWeekView } from './base/BaseWeekView';
import { BaseRowsTable } from './base/BaseRowsTable';
import { BaseRewriteFile } from './base/BaseRewriteFile';
import { BaseEditDialog, type RowEdit } from './base/BaseEditDialog';
import { DeleteWeekDialog } from './base/DeleteWeekDialog';
import { downloadBaseCsv, downloadBaseXlsx } from './base/baseExport';


type BaseData = Awaited<ReturnType<typeof getBaseData>>;
interface Props { session: UserSessionInfo; onBaseUpdated: () => void }

export function BaseTab({ session, onBaseUpdated }: Props) {
  const [data, setData] = useState<BaseData | null>(null);
  const [weekToDelete, setWeekToDelete] = useState<{ group: string; people: number } | null>(null);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [showRewrite, setShowRewrite] = useState(false);
  const [editing, setEditing] = useState<StoredEngagementRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleteToken, setDeleteToken] = useState('');
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [reprocessingGroup, setReprocessingGroup] = useState<string | null>(null);

  const clientClaim = useMemo(
    () => (session.email ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin } : undefined),
    [session]
  );

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getBaseData({ data: { clientClaim } });
      setData(res ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'Não foi possível ler a Base.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientClaim]);

  useEffect(() => { void load(false); }, [load]);
  const changed = () => { void load(true); onBaseUpdated(); };

  const rows = data?.rows ?? [];
  const statusOf = (g: string) => (data?.weekStatus.find((s) => normText(s.group) === normText(g))?.status === 'validada' ? 'Validada' : 'Pendente');
  const exportRows = async (group: string | null, ext: 'csv' | 'xlsx') => {
    const list = group ? rows.filter((r) => normText(r.group) === normText(group)) : rows;
    try {
      if (ext === 'csv') downloadBaseCsv(list, group, statusOf);
      else await downloadBaseXlsx(list, group, statusOf);
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível gerar o arquivo.' });
    }
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await clearBaseData({ data: { token: deleteToken.trim() || undefined, clientClaim } });
      await clearAllCachedSnapshots();
      setNotice({ ok: true, text: 'A Base interna foi apagada. O quadro não foi alterado.' });
      changed();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível apagar a Base.' });
    } finally { setDeleting(false); }
  };

  // 1) grava na Base; 2) espelha no quadro e confere por leitura de volta; falha no quadro não desfaz a Base
  const saveEdits = async (edits: RowEdit[], token: string) => {
    setSaving(true);
    let baseText = '';
    try {
      const res = await updateBaseRows({ data: { edits, token: token.trim() || undefined, clientClaim } });
      baseText = `${res.updated} ${res.updated === 1 ? 'linha gravada' : 'linhas gravadas'} na Base.${res.notFound ? ` ${res.notFound} não encontradas.` : ''}`;
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível gravar as alterações na Base. Nada foi enviado ao quadro.' });
      setSaving(false);
      return;
    }
    try {
      const m = await mirrorEditedRows({ data: { keys: edits.map((e) => e.key), token: token.trim() || undefined, clientClaim } });
      if (m.skipped) setNotice({ ok: false, text: `${baseText} Sem token: o quadro não foi alterado e a edição ficou na fila da semana.` });
      else if (m.failures.length === 0) setNotice({ ok: true, text: `${baseText} Quadro confirmado por leitura de volta: ${m.confirmed}.` });
      else setNotice({ ok: false, text: `${baseText} Quadro confirmado: ${m.confirmed}. Não confirmado (ficou na fila): ${m.failures.map((f) => `${f.name} — ${f.reason}`).join(' · ')}` });
    } catch (e) {
      setNotice({ ok: false, text: `${baseText} A Base continua válida, mas o envio ao quadro falhou: ${(e as Error).message || 'erro desconhecido'}.` });
    } finally {
      setSaving(false);
      setEditing(null);
      changed();
    }
  };

  const setStatus = async (group: string, action: 'validar' | 'reabrir') => {
    setSavingGroup(group);
    try {
      const doc = action === 'validar'
        ? await setWeekValidation({ data: { group, status: 'validada', clientClaim } })
        : await reopenWeek({ data: { group, clientClaim } });
      setData((prev) => prev && { ...prev, weekStatus: [...prev.weekStatus.filter((s) => normText(s.group) !== normText(group)), doc] });
      if (action === 'reabrir') changed();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível salvar a validação.' });
    } finally { setSavingGroup(null); }
  };

  const setPeriod = async (group: string, start: string, end: string): Promise<string | null> => {
    const res = await setWeekPeriods({ data: { items: [{ group, start, end }], clientClaim } });
    const r = res?.results?.[0];
    if (!r?.ok) return r?.message ?? 'Não foi possível salvar o período.';
    await clearAllCachedSnapshots();
    setNotice({ ok: true, text: `${group}: período salvo · ${r.people ?? 0} pessoas · ${r.added ?? 0} checks acrescentados. A semana já entra nos scores.` });
    changed();
    return null;
  };

  const doDeleteWeek = async (typed: string) => {
    if (!weekToDelete) return;
    setDeletingWeek(true);
    try {
      const r = await deleteWeek({ data: { group: weekToDelete.group, confirmName: typed, clientClaim } });
      await clearAllCachedSnapshots();
      setNotice({ ok: true, text: `Semana “${weekToDelete.group}” apagada da Base (${r?.removed ?? 0} linhas). O quadro não foi alterado.` });
      setWeekToDelete(null);
      changed();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível apagar a semana.' });
      setWeekToDelete(null);
    } finally { setDeletingWeek(false); }
  };

  const reprocess = async (group: string) => {
    setReprocessingGroup(group);
    try {
      const r = await reprocessWeekChecks({ data: { group, clientClaim } });
      const br = (iso: string) => iso.split('-').reverse().join('/');
      const days = Object.entries(r.byDay).filter(([, n]) => n > 0).map(([d, n]) => `${d} ${n}`).join(', ') || 'nenhum';
      setNotice({ ok: true, text: `${group}: semana ${br(r.weekStart)} a ${br(r.weekEnd)} · ${r.people} pessoas · ${r.added} checks acrescentados · checks por dia: ${days} · fora da semana: ${r.outside} · sem último acesso: ${r.noAccess}. Semana voltou para pendente.` });
      changed();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message || 'Não foi possível recalcular os checks.' });
    } finally { setReprocessingGroup(null); }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}</div>;
  }
  if (error && !data) {
    return <p className="max-w-6xl mx-auto text-sm text-destructive bg-destructive/10 rounded-2xl p-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>;
  }
  const groups = new Set(rows.map((r) => normText(r.group)).filter(Boolean));
  const totalChecks = rows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);

  return (
    <div className={`space-y-6 max-w-6xl mx-auto ${refreshing ? 'opacity-80' : ''}`}>
      <section className="bg-card rounded-3xl soft-stack-card p-6 border border-border space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0"><Database className="w-6 h-6" /></span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-foreground">Base de Dados do Engajamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fonte de leitura de painéis, filtros e scores. Uma linha por pessoa e semana; o quadro é espelho.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void exportRows(null, 'xlsx')} disabled={rows.length === 0} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-4 h-4" /> Base .xlsx</button>
            <button type="button" onClick={() => void exportRows(null, 'csv')} disabled={rows.length === 0} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-4 h-4" /> Base .csv</button>
            <button type="button" onClick={() => setShowRewrite((v) => !v)} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted inline-flex items-center gap-1.5"><FileUp className="w-4 h-4" /> Reescrever base</button>
            <button type="button" onClick={() => { setDeleteWord(''); setDeleteToken(''); setConfirmDelete(true); }} disabled={deleting || rows.length === 0}
              className="h-10 px-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 inline-flex items-center gap-1.5">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Apagar base
            </button>
            <button type="button" aria-label="Recarregar a Base" onClick={() => void load(true)} className="h-10 w-10 rounded-xl border border-border grid place-items-center hover:bg-muted"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Linhas (pessoa × semana)', rows.length],
            ['Semanas', groups.size],
            ['Checks na Base', totalChecks],
            ['Última gravação', data?.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
          ].map(([l, v]) => (
            <div key={l} className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</p>
              <p className="text-xl font-semibold text-foreground tabular-nums mt-0.5 truncate">{v}</p>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {(data?.deletions?.length ?? 0) > 0
            ? <>Histórico de exclusões: {(data?.deletions ?? []).map((d) => `${d.deletedByName || d.deletedByEmail || '—'} em ${new Date(d.deletedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} (${d.rowsDeleted} linhas)`).join(' · ')}</>
            : 'Nenhuma exclusão da Base registrada.'}
          {(data?.weekLog?.length ?? 0) > 0 ? <p className="mt-1">Histórico das semanas: {(data?.weekLog ?? []).map((l) => `${({ apagou_semana: 'apagou', reabriu_semana: 'reabriu', definiu_periodo: 'definiu o período de', removida_na_importacao: 'removida na importação:' } as Record<string, string>)[l.action] ?? l.action} ${l.group} · ${l.byName || l.byEmail || '—'} em ${new Date(l.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`).join(' · ')}</p> : null}
        </div>
        {notice && (
          <p className={`text-xs rounded-xl p-3 flex items-start gap-2 break-words ${notice.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {notice.text}
          </p>
        )}
        {showRewrite && (
          <div className="rounded-2xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Reescrever base</h3>
            <p className="text-xs text-muted-foreground">Edite itens direto na tabela de registros (selecione um ou vários) ou suba um arquivo abaixo.</p>
            <BaseRewriteFile clientClaim={clientClaim} onSaved={changed} />
          </div>
        )}
      </section>

      <section className="bg-gradient-to-br from-[hsl(var(--brand-sky))] to-[hsl(var(--brand-sky-2))] rounded-3xl border border-border p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-[hsl(var(--brand-navy))]">Sincronia Quadro x Base</h3>
          <p className="text-xs text-[hsl(var(--brand-navy)/0.8)]">Compara por e-mail + semana. Se o quadro estiver fora do ar, painéis e scores seguem lendo a Base.</p>
        </div>
        <BaseSyncPanel clientClaim={clientClaim} sync={data?.sync ?? null} queues={data?.queues ?? []} onChanged={changed} />
      </section>

      <section className="bg-card rounded-3xl soft-stack-card p-4 sm:p-6 border border-border space-y-4 min-w-0">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <CalendarRange className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">Validação por semana</h3>
            <p className="text-xs text-muted-foreground">Uma linha por pessoa na semana escolhida. Busque e edite a pessoa pelo lápis.</p>
          </div>
        </div>
        <BaseWeekView rows={rows} weekStatus={data?.weekStatus ?? []} savingGroup={savingGroup} onValidate={(g) => void setStatus(g, 'validar')} onReopen={(g) => void setStatus(g, 'reabrir')} onDeleteWeek={(g, n) => setWeekToDelete({ group: g, people: n })} onSetPeriod={setPeriod} onExport={(g, ext) => void exportRows(g, ext)} reprocessingGroup={reprocessingGroup} onReprocess={(g) => void reprocess(g)} onEdit={(r) => setEditing([r])} />
      </section>

      <section className="bg-card rounded-3xl soft-stack-card p-4 sm:p-6 border border-border space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Table2 className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">Todos os registros</h3>
              <p className="text-xs text-muted-foreground">Todas as semanas da Base. Selecione um ou vários para editar em série.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted shrink-0">
            {showAll ? 'Recolher' : 'Mostrar'}
          </button>
        </div>
        {showAll && <BaseRowsTable rows={rows} onEdit={setEditing} />}
      </section>

      {weekToDelete && <DeleteWeekDialog group={weekToDelete.group} people={weekToDelete.people} busy={deletingWeek} onCancel={() => setWeekToDelete(null)} onConfirm={(t) => void doDeleteWeek(t)} />}

      {editing && <BaseEditDialog rows={editing} saving={saving} onClose={() => setEditing(null)} onSave={(e, token) => void saveEdits(e, token)} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-card max-w-md w-full rounded-3xl border border-border p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Apagar a Base</h3>
            <p className="text-sm text-foreground">Serão apagadas todas as {rows.length} linhas da Base interna (pessoa × semana), os metadados da Base e a lista de projetos guardada. O quadro do monday não é alterado. A exclusão fica registrada no histórico com seu nome e o horário.</p>
            <label className="block space-y-1.5 text-xs text-foreground">
              <span>Digite <strong>APAGAR</strong> para confirmar</span>
              <input value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} autoFocus className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="block space-y-1.5 text-xs text-foreground">
              <span>Token da API do monday (confirma que é a sua conta; não é salvo)</span>
              <input type="password" value={deleteToken} onChange={(e) => setDeleteToken(e.target.value)} autoComplete="off" className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 px-4 rounded-xl border border-border text-xs">Cancelar</button>
              <button type="button" disabled={deleteWord.trim() !== 'APAGAR'} onClick={() => void doDelete()} className="h-10 px-4 rounded-xl bg-destructive text-card text-xs font-medium disabled:opacity-50">Apagar base</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
