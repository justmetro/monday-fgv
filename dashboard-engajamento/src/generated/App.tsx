import { useMemo, useState } from 'react';
import { parseDateFlexible, toISODate } from './lib/dates';
import {
  UploadCloud,
  BarChart3,
  FolderKanban,
  Database,
  User,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Building2,
} from 'lucide-react';
import { useUserSession } from './hooks/useUserSession';
import { useStoredEngagement } from './hooks/useStoredEngagement';
import { UpdatePanelTab } from './components/update-panel/UpdatePanelTab';
import { BaseTab } from './components/BaseTab';
import { DailyScoreProvider } from './hooks/dailyScoreContext';
import { EngagementDashboard } from './components/EngagementDashboard';
import { ManagerTab } from './components/ManagerTab';
import { MyProfileTab } from './components/MyProfileTab';
import { CommunicationTab } from './components/CommunicationTab';
import { DepartmentTab } from './components/DepartmentTab';
import { useApus } from './hooks/useApus';
import type { TimeGranularity } from './lib/dates';

type Tab = 'dashboard' | 'dgpe' | 'manager' | 'comm' | 'profile' | 'base' | 'update';

// Diagnóstico temporário da sessão (fonte do usuário, e-mail, dono/admin/PMO).
// Só aparece fora do "Editar APP" e só para o dono. Troque para false para desligar.
const SHOW_SESSION_DIAGNOSTIC = true;

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [granularity, setGranularityState] = useState<TimeGranularity>('weekly');
  // Período escolhido (mês, trimestre, semestre ou ano). Sem escolha, vale o mais recente com semana analisada.
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const setGranularity = (g: TimeGranularity) => {
    setGranularityState(g);
    setPeriodKey(null);
  };

  const { session, loading: loadingSession, editMode, sources: sessionSources, refreshSession } = useUserSession();
  const {
    snapshot,
    weeks,
    activeProjects,
    loading: loadingData,
    refreshing,
    error,
    fallback,
    refresh,
    dailyScores,
    period,
  } = useStoredEngagement(granularity, undefined, { periodKey });

  // Nome do grupo (ex.: "Semana 2") de cada data de análise, para a frase do card
  const weekGroupNames = useMemo(() => {
    const map: Record<string, string> = {};
    (snapshot?.rows ?? []).forEach((r) => {
      const key = toISODate(parseDateFlexible(r.refDate));
      if (key && r.group && !map[key]) map[key] = r.group;
    });
    return map;
  }, [snapshot]);

  const loading = loadingSession || loadingData;
  const canManage = Boolean(session?.canManage);
  const apus = useApus(canManage ? session ?? null : null);
  // Aba Base: só o dono do app e a lista de PMOs (o servidor confere de novo a cada ação)
  const canAccessBase = Boolean(session?.isOwner || session?.isPmo);

  // Regra estrita de acesso: sem gestão só acessa Painel do Gerente e Meu Perfil
  const activeTab: Tab = canManage ? tab : tab === 'profile' ? 'profile' : 'manager';

  const navButton = (id: Tab, label: string, Icon: typeof BarChart3) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`h-10 px-3.5 text-xs rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
        activeTab === id
          ? 'bg-card text-foreground font-semibold shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      {label}
    </button>
  );

  const headerBadge = session?.isOwner ? 'Dono' : session?.isAdmin ? 'Admin' : session?.isPmo ? 'PMO' : null;

  return (
    <DailyScoreProvider value={dailyScores}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-sm tracking-[-0.01em] text-foreground font-medium flex items-center gap-2">
                <span>Engajamento Hub</span>
                {headerBadge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                    {headerBadge}
                  </span>
                )}
              </span>

              {/* Navegação entre abas com restrição de acesso */}
              <nav className="flex items-center gap-1 p-1 rounded-2xl bg-muted/70 overflow-x-auto">
                {canManage && navButton('dashboard', 'Engajamento', BarChart3)}
                {canManage && navButton('dgpe', 'DGPE', Building2)}
                {navButton('manager', 'Painel do Gerente', FolderKanban)}
                {canManage && navButton('comm', 'Comunicação', MessageSquare)}
                {navButton('profile', 'Meu Perfil', User)}
                {canAccessBase && navButton('base', 'Base', Database)}
                {canManage && navButton('update', 'Atualizar Painel', UploadCloud)}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                title="Recarregar dados da base"
                className="h-9 w-9 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Sem e-mail legível não há como dar o acesso certo: avisa em vez de cair em silêncio como usuário comum */}
        {!loadingSession && session && !session.email ? (
          <div role="alert" className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-xs text-destructive flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p>Não foi possível ler o e-mail da sua conta. Recarregue a página; se continuar, avise o dono do app.</p>
              <p className="text-[11px]">Modo do app: {editMode ? 'edição' : 'normal'}</p>
              <ul className="text-[11px] space-y-0.5">
                {[...sessionSources, ...(session.diag?.sources ?? [])].map((s) => (
                  <li key={s.source} className="break-words">
                    {s.source}: respondeu {s.responded ? 'sim' : 'não'} · e-mail {s.emailDomain ? `sim (${s.emailDomain})` : 'não'} · {s.ms} ms{s.error ? ` · ${s.error}` : ''}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => void refreshSession()} className="h-9 px-3 rounded-lg border border-destructive/40 hover:bg-destructive/10">Tentar de novo</button>
                <button type="button" onClick={() => window.location.reload()} className="h-9 px-3 rounded-lg border border-destructive/40 hover:bg-destructive/10">Recarregar a página</button>
              </div>
            </div>
          </div>
        ) : null}

        {SHOW_SESSION_DIAGNOSTIC && !editMode && session?.isOwner && session.diag ? (
          <div className="bg-muted/60 border-b border-border px-4 py-1.5 text-[11px] text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="font-semibold text-foreground">Diagnóstico (temporário)</span>
            <span>Usuário: {session.diag.userSource}</span>
            <span>E-mail: {session.email ? `sim (${session.email})` : 'não'} · fonte {session.diag.emailSource}</span>
            <span>Dono {session.isOwner ? 'sim' : 'não'} · Admin {session.isAdmin ? 'sim' : 'não'} · PMO {session.isPmo ? 'sim' : 'não'}</span>
            <span>Modo do app: {session.diag.appMode}</span>
            {session.diag.serverError ? <span>Monday no servidor: {session.diag.serverError}</span> : null}
          </div>
        ) : null}

        {/* Indicador de Plano B / Base interna ativa (contagem: nunca escrever "0" na tela) */}
        {fallback > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Exibindo dados da Base interna sincronizada. O painel e os scores continuam operando normalmente.</span>
          </div>
        )}

        {/* Conteúdo principal */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {activeTab === 'dashboard' && canManage && (
            <EngagementDashboard
              weeks={weeks}
              activeProjects={activeProjects}
              loading={loading}
              refreshing={refreshing}
              error={error}
              granularity={granularity}
              onGranularityChange={setGranularity}
              period={period}
              onPeriodChange={setPeriodKey}
              absences={snapshot?.absences ?? []}
              onAbsenceChanged={() => void refresh()}
              userName={session?.name}
              canManage={canManage}
              weekGroupNames={weekGroupNames}
              apusData={apus.data}
            />
          )}

          {activeTab === 'dgpe' && canManage && (
            <DepartmentTab
              weeks={weeks}
              activeProjects={activeProjects}
              loading={loading}
              granularity={granularity}
              onGranularityChange={setGranularity}
              period={period}
              onPeriodChange={setPeriodKey}
              absences={snapshot?.absences ?? []}
              onAbsenceChanged={() => void refresh()}
              canManage={canManage}
            />
          )}

          {activeTab === 'manager' && session && (
            <ManagerTab
              weeks={weeks}
              activeProjects={activeProjects}
              userSession={session}
              granularity={granularity}
              onGranularityChange={setGranularity}
              period={period}
              periodKey={periodKey}
              onPeriodChange={setPeriodKey}
              absences={snapshot?.absences ?? []}
              onAbsenceChanged={() => void refresh()}
            />
          )}

          {activeTab === 'comm' && canManage && session && <CommunicationTab session={session} weeks={weeks} activeProjects={activeProjects} />}

          {activeTab === 'profile' && (
            <MyProfileTab
              weeks={weeks}
              absences={snapshot?.absences ?? []}
              onAbsenceChanged={() => void refresh()}
            />
          )}

          {activeTab === 'base' && canAccessBase && session && (
            <BaseTab session={session} onBaseUpdated={() => void refresh()} />
          )}

          {/* Fica montada (só escondida) para a gravação no quadro continuar ao trocar de aba */}
          {canManage && (
            <div hidden={activeTab !== 'update'}>
              <UpdatePanelTab snapshot={snapshot} onSnapshotUpdated={() => void refresh()} />
            </div>
          )}
        </main>

      </div>
    </DailyScoreProvider>
  );
}
