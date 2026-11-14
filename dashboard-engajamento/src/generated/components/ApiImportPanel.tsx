import { useEffect, useState } from 'react';
import { errorText } from '@generated/lib/errorText';
import { KeyRound, Database, Loader2, AlertCircle, CheckCircle2, Lock, Save } from 'lucide-react';
import {
  getBoardIdsConfig,
  saveBoardIdsConfig,
  readImportPage,
  applyImportedSnapshot,
} from '@generated/server/storage';
import type { ImportReport, WeeksImportReport } from '@generated/models';
import { useUserSession } from '@generated/hooks/useUserSession';
import { clearAllCachedSnapshots } from '@generated/lib/snapshotCache';
import { PendingWeeksList } from './PendingWeeksList';

interface Props {
  onImported: () => void;
  onReportChange: (report: ImportReport) => void;
}

export function ApiImportPanel({ onImported, onReportChange }: Props) {
  const { session } = useUserSession();

  // Estado efêmero do token (nunca salvo nem persistido)
  const [token, setToken] = useState('');

  // IDs dos quadros (salvos no Vibe DB)
  const [engBoardId, setEngBoardId] = useState('');
  const [projBoardId, setProjBoardId] = useState('');
  const [savingIds, setSavingIds] = useState(false);
  const [idsSavedMsg, setIdsSavedMsg] = useState(false);

  // Estados de execução da importação
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [weeksReport, setWeeksReport] = useState<WeeksImportReport | null>(null);
  const [pendingKey, setPendingKey] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);

  const clientClaim = session?.email
    ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
    : undefined;

  // Carrega os IDs dos quadros já configurados
  useEffect(() => {
    // Só consulta depois que a sessão confirmar o acesso de gestão
    if (!session?.canManage) return;
    getBoardIdsConfig({ data: clientClaim })
      .then((res) => {
        if (res) {
          setEngBoardId(res.engagementBoardId || '');
          setProjBoardId(res.projectsBoardId || '');
        }
      })
      .catch((e) => console.error('Erro ao carregar IDs dos quadros:', e));
  }, [session]);

  const handleSaveBoardIds = async () => {
    if (!engBoardId.trim() || !projBoardId.trim()) return;
    setSavingIds(true);
    setIdsSavedMsg(false);
    try {
      await saveBoardIdsConfig({
        data: {
          engagementBoardId: engBoardId.trim(),
          projectsBoardId: projBoardId.trim(),
          clientClaim,
        },
      });
      setIdsSavedMsg(true);
      setTimeout(() => setIdsSavedMsg(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIds(false);
    }
  };

  const handleRunApiImport = async () => {
    if (!token.trim() || !engBoardId.trim() || !projBoardId.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      // Salva os IDs dos quadros caso tenham sido alterados
      await saveBoardIdsConfig({
        data: {
          engagementBoardId: engBoardId.trim(),
          projectsBoardId: projBoardId.trim(),
          clientClaim,
        },
      });

      const ids = { token: token.trim(), engagementBoardId: engBoardId.trim(), projectsBoardId: projBoardId.trim(), clientClaim };
      // Leitura em páginas curtas (cada chamada termina rápido); só no fim a Base é regravada
      const engRows: Awaited<ReturnType<typeof readImportPage>>['engRows'] = [];
      const projRows: Awaited<ReturnType<typeof readImportPage>>['projRows'] = [];
      let names = { engName: '', projName: '', groups: [] as string[] };
      for (const which of ['proj', 'eng'] as const) {
        let cursor: string | null = null;
        let guard = 0;
        do {
          setProgress(which === 'proj' ? 'Lendo projetos…' : `Lendo engajamento… ${engRows.length} linhas`);
          const page: Awaited<ReturnType<typeof readImportPage>> = await readImportPage({ data: { ...ids, which, cursor } });
          engRows.push(...(page?.engRows ?? []));
          projRows.push(...(page?.projRows ?? []));
          names = { engName: page.engName, projName: page.projName, groups: page.groups };
          cursor = page?.cursor ?? null;
          guard++;
        } while (cursor && guard < 200);
      }
      setProgress(`Gravando ${engRows.length} linhas na Base…`);
      const res = await applyImportedSnapshot({ data: { ...ids, ...names, engRows, projRows } });

      if (res?.success) {
        setSuccess(true);
        setWeeksReport(res.report?.weeks ?? null);
        setPendingKey((k) => k + 1);
        await clearAllCachedSnapshots();
        onReportChange(res.report);
        onImported();
      }
    } catch (e) {
      console.error(e);
      setError(errorText(e, 'Não foi possível importar pela API do monday.'));
    } finally {
      // Regra de segurança: token sempre limpo ao terminar (sucesso ou erro)
      setToken('');
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <section className="bg-card rounded-lg p-6 border border-border space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h3 className="text-base font-medium text-foreground">Importação Direta pela API do monday</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Consulte os quadros diretamente com o seu token pessoal de API. O token fica apenas na memória da página durante a execução e nunca é salvo.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-[11px] text-muted-foreground shrink-0">
          <Lock className="w-3 h-3" /> Token não armazenado
        </span>
      </div>

      {/* IDs dos Quadros */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-muted-foreground" /> IDs dos Quadros no monday.com
          </p>
          {idsSavedMsg && (
            <span className="text-[11px] text-primary flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> IDs salvos
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="board-id-eng" className="block text-[11px] font-medium text-foreground">
              ID do Quadro Análise de Engajamento
            </label>
            <input
              id="board-id-eng"
              type="text"
              placeholder="Ex: 5003349457"
              value={engBoardId}
              onChange={(e) => setEngBoardId(e.target.value)}
              className="w-full h-9 text-xs px-3 rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="board-id-proj" className="block text-[11px] font-medium text-foreground">
              ID do Quadro Histórico de Projetos
            </label>
            <input
              id="board-id-proj"
              type="text"
              placeholder="Ex: 5003349458"
              value={projBoardId}
              onChange={(e) => setProjBoardId(e.target.value)}
              className="w-full h-9 text-xs px-3 rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveBoardIds}
            disabled={savingIds || !engBoardId.trim() || !projBoardId.trim()}
            className="h-8 px-3 rounded border border-border bg-card text-[11px] text-foreground hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3 h-3" /> Salvar IDs
          </button>
        </div>
      </div>

      {/* Campo de Senha para Token Pessoal */}
      <div className="space-y-1.5">
        <label htmlFor="monday-api-token" className="block text-xs font-medium text-foreground">
          Token da API do monday
        </label>
        <input
          id="monday-api-token"
          type="password"
          autoComplete="off"
          placeholder="Cole seu token pessoal do monday.com (ex: eyJhbGciOi...)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={busy}
          className="w-full h-10 text-xs px-3 rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground">
          Obtenha seu token pessoal em <em>Avatar &gt; Desenvolvedores &gt; Minha chave de API (V2)</em>. O token é descartado assim que a importação finaliza.
        </p>
      </div>

      {/* Botão de Ação */}
      <div className="flex justify-end">
        <button
          onClick={handleRunApiImport}
          disabled={busy || !token.trim() || !engBoardId.trim() || !projBoardId.trim()}
          className="h-11 px-5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {busy ? progress ?? 'Importando via API...' : 'Importar pela API'}
        </button>
      </div>

      {/* Mensagens de Sucesso ou Erro */}
      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span>Base atualizada como espelho do quadro de Análise de Engajamento.</span>
        </div>
      )}

      {weeksReport ? (
        <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">Relatório das semanas</p>
          <p><strong className="text-foreground">Mantidas ({weeksReport.kept.length}):</strong> {weeksReport.kept.join(', ') || 'nenhuma'}</p>
          <p><strong className="text-foreground">Novas ({weeksReport.created.length}):</strong> {weeksReport.created.join(', ') || 'nenhuma'}</p>
          <p><strong className="text-foreground">Removidas ({weeksReport.removed.length}):</strong> {weeksReport.removed.join(', ') || 'nenhuma'}</p>
          <p><strong className="text-foreground">Pessoas por semana:</strong> {weeksReport.people.map((p) => `${p.group} (${p.people})`).join(' · ') || '—'}</p>
        </div>
      ) : null}

      {session?.canManage ? <PendingWeeksList clientClaim={clientClaim} refreshKey={pendingKey} onChanged={onImported} /> : null}
    </section>
  );
}
