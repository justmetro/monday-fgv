import { useMemo, useState } from 'react';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import type { StoredProjectItem, AbsenceDoc } from '@generated/models';
import type { UserSessionInfo } from '@generated/server/storage';
import type { TimeGranularity } from '@generated/lib/dates';
import { useStoredEngagement, type PeriodView } from '@generated/hooks/useStoredEngagement';
import { ManagerDashboard } from './ManagerDashboard';

interface Props {
  weeks: WeekSummary[];
  activeProjects: StoredProjectItem[];
  userSession: UserSessionInfo;
  granularity: TimeGranularity;
  onGranularityChange: (g: TimeGranularity) => void;
  period: PeriodView;
  periodKey: string | null;
  onPeriodChange: (key: string) => void;
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged: () => void;
}

/**
 * Painel do Gerente com o modo "Ver como gerente" isolado:
 * a escolha vive só aqui e nunca altera a sessão nem os dados das outras abas.
 */
export function ManagerTab(props: Props) {
  const canManage = Boolean(props.userSession.canManage);
  const [viewAs, setViewAs] = useState('');
  const activeViewAs = canManage ? viewAs.trim() : '';

  // Dados próprios do modo "Ver como gerente" (só carregados quando há gerente escolhido)
  const scoped = useStoredEngagement(props.granularity, activeViewAs || undefined, { skip: !activeViewAs, periodKey: props.periodKey });

  // Lista de gerentes sempre a partir da base completa do usuário real
  const managerOptions = useMemo(() => {
    if (!canManage) return [];
    const set = new Set<string>();
    props.activeProjects.forEach((p) => (p.managers || []).forEach((m) => m.trim() && set.add(m.trim())));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [canManage, props.activeProjects]);

  if (activeViewAs && scoped.loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  // Com a última cópia sincronizada da visão simulada disponível, continua nela
  const scopedFailed = Boolean(scoped.error) && !scoped.stale;
  const useScoped = Boolean(activeViewAs) && !scopedFailed;

  return (
    <>
      {activeViewAs && scopedFailed && (
        <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          Não foi possível carregar a visão de {activeViewAs}. Exibindo a sua visão.
        </p>
      )}
      <ManagerDashboard
        weeks={useScoped ? scoped.weeks : props.weeks}
        activeProjects={useScoped ? scoped.activeProjects : props.activeProjects}
        userSession={props.userSession}
        granularity={props.granularity}
        onGranularityChange={props.onGranularityChange}
        period={useScoped ? scoped.period : props.period}
        onPeriodChange={props.onPeriodChange}
        absences={useScoped ? scoped.snapshot?.absences ?? [] : props.absences}
        onAbsenceChanged={() => {
          props.onAbsenceChanged();
          if (useScoped) void scoped.refresh();
        }}
        viewAsManager={activeViewAs || undefined}
        onViewAsManagerChange={canManage ? setViewAs : undefined}
        managerOptions={managerOptions}
      />
    </>
  );
}
