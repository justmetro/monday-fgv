import { errorText } from '@generated/lib/errorText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readCachedSnapshot, snapshotCacheKey, writeCachedSnapshot } from '@generated/lib/snapshotCache';
import { getStoredSnapshot, type EngagementSnapshotView } from '@generated/server/storage';
import { buildWeeks, type EngagementRecord, type WeekGroupInput, type WeekSummary } from '@generated/lib/engagementMetrics';
import { filterActiveProjects } from '@generated/lib/activeProjects';
import { buildPeriodOptions, groupsInPeriod, type PeriodOption } from '@generated/lib/periods';
import type { StoredProjectItem } from "@generated/models";
import { parseDateFlexible, type TimeGranularity } from '@generated/lib/dates';
import { isActivatedStatus } from '@generated/lib/userStatus';
import { buildUserScores } from '@generated/lib/dailyScore';
import { useUserSession } from './useUserSession';

/** Visão do período escolhido nos painéis (semanal não usa). */
export interface PeriodView {
  options: PeriodOption[];
  selected: PeriodOption | null;
  summary: WeekSummary | null;
  groups: string[]; // Grupos (semanas) que caem no período
}

// Novas tentativas na abertura e repetição em segundo plano quando a leitura falha
const RETRY_WAITS_MS = [1500, 4000];
const BACKGROUND_RETRY_MS = 30000;

/**
 * Carrega a base salva. `viewAsManager` só deve ser usado pelo Painel do Gerente;
 * o restante do app chama sem ele e sempre enxerga o usuário real logado.
 */
export function useStoredEngagement(
  granularity: TimeGranularity = 'weekly',
  viewAsManager?: string,
  options?: { skip?: boolean; periodKey?: string | null }
) {
  const skip = Boolean(options?.skip);
  const { session, loading: sessionLoading } = useUserSession();
  const [snapshot, setSnapshot] = useState<EngagementSnapshotView | null>(null);
  const [hasData, setHasData] = useState<boolean>(false);
  const [loading, setLoading] = useState(!skip);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientClaim = useMemo(() => {
    return session?.email
      ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
      : undefined;
  }, [session]);

  // Quando a leitura falha e mostramos a última cópia sincronizada
  const [stale, setStale] = useState(false);
  const requestSeq = useRef(0);
  const hasSnapshotRef = useRef(false);
  const viewIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (skip || sessionLoading) return;
      const seq = ++requestSeq.current;
      const isCurrent = () => seq === requestSeq.current; // ignora respostas atrasadas
      if (isRefresh || hasSnapshotRef.current) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const viewAs = viewAsManager?.trim() || undefined;
      const cacheKey = snapshotCacheKey(session?.email ?? '', viewAs);
      // Mudou o usuário ou o gerente simulado: nunca reaproveita dados da visão anterior
      const viewId = `${session?.email ?? ''}|${viewAs ?? ''}`;
      if (viewIdRef.current !== viewId) {
        viewIdRef.current = viewId;
        hasSnapshotRef.current = false;
        if (!isRefresh) setRefreshing(false);
        setLoading(true);
      }
      try {
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < RETRY_WAITS_MS.length + 1; attempt++) {
          try {
            const res = await getStoredSnapshot({ data: { clientClaim, viewAsManager: viewAs } });
            if (!isCurrent()) return;
            if (res?.hasData && res.snapshot) {
              setSnapshot(res.snapshot);
              setHasData(true);
              hasSnapshotRef.current = true;
              if (cacheKey) void writeCachedSnapshot(cacheKey, res.snapshot);
            } else {
              setSnapshot(null);
              setHasData(false);
              hasSnapshotRef.current = false;
            }
            setStale(false);
            return;
          } catch (e) {
            lastErr = e;
            const wait = RETRY_WAITS_MS[attempt];
            if (wait === undefined || !isCurrent()) break;
            await new Promise((r) => setTimeout(r, wait));
            if (!isCurrent()) return;
          }
        }
        if (!isCurrent()) return;
        console.error('Erro ao ler dados persistidos:', errorText(lastErr));
        // Mantém o que já está na tela; se nada, usa a última cópia sincronizada deste navegador
        if (!hasSnapshotRef.current && cacheKey) {
          const cached = await readCachedSnapshot(cacheKey);
          if (!isCurrent()) return;
          if (cached) {
            setSnapshot(cached);
            setHasData(true);
            hasSnapshotRef.current = true;
          }
        }
        setStale(hasSnapshotRef.current);
        setError('Não foi possível atualizar a base agora. Nova tentativa automática em instantes.');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clientClaim, viewAsManager, skip, sessionLoading, session?.email]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Se a leitura falhou, tenta de novo sozinho em segundo plano
  useEffect(() => {
    if (!error || skip) return;
    const t = setTimeout(() => void load(true), BACKGROUND_RETRY_MS);
    return () => clearTimeout(t);
  }, [error, skip, load]);

  const prepared = useMemo(() => {
    if (!snapshot) {
      return {
        records: [] as EngagementRecord[],
        projs: [] as StoredProjectItem[],
        mapping: {} as Record<string, string>,
        absences: [] as EngagementSnapshotView["absences"],
        groups: [] as WeekGroupInput[],
        skipped: 0,
        fallback: 0,
      };
    }

    let missing = 0;
    let usedFallback = 0;

    // Só usuários com Status do usuário "Ativado" entram em qualquer cálculo
    const records = (snapshot.rows || []).filter((r) => isActivatedStatus(r.userStatus)).flatMap((r) => {
      let ref = parseDateFlexible(r.refDate);
      if (!ref) {
        ref = parseDateFlexible(r.weekStart);
        if (ref) usedFallback++;
      }
      if (!ref) {
        missing++;
        return [];
      }
      return [
        {
          name: r.name,
          email: r.email,
          team: r.team,
          department: r.department,
          lastAccess: parseDateFlexible(r.lastAccess),
          refDate: ref,
          group: r.group,
          checkedDays: r.checkedDays ?? [],
        },
      ];
    });

    const projs = filterActiveProjects(snapshot.projects);
    const mapping = snapshot.deParaTable || {};
    const absences = snapshot.absences || [];

    return {
      records,
      projs,
      mapping,
      absences,
      groups: snapshot.weekGroups ?? [],
      skipped: missing,
      fallback: usedFallback,
    };
  }, [snapshot]);

  const { activeProjects, deParaTable, skipped, fallback } = {
    activeProjects: prepared.projs,
    deParaTable: prepared.mapping,
    skipped: prepared.skipped,
    fallback: prepared.fallback,
  };

  // Visão semanal (uma por semana da Base): usada pela escolha de semana e por telas que só precisam das pessoas
  const weeks = useMemo(
    () => buildWeeks(prepared.records, prepared.projs, 'weekly', prepared.mapping, prepared.absences, prepared.groups),
    [prepared]
  );

  // Período escolhido (mês, trimestre, semestre ou ano): sem escolha, vale o mais recente que tenha semana analisada
  const periodOptions = useMemo(() => buildPeriodOptions(granularity, new Date()), [granularity]);
  const selectedPeriod = useMemo<PeriodOption | null>(() => {
    if (granularity === 'weekly') return null;
    const chosen = periodOptions.find((o) => o.key === options?.periodKey);
    if (chosen) return chosen;
    return periodOptions.find((o) => groupsInPeriod(prepared.groups, o).length > 0) ?? periodOptions[0] ?? null;
  }, [granularity, periodOptions, options?.periodKey, prepared.groups]);

  const period = useMemo<PeriodView>(() => {
    if (!selectedPeriod) return { options: periodOptions, selected: null, summary: null, groups: [] };
    const summary =
      buildWeeks(prepared.records, prepared.projs, granularity, prepared.mapping, prepared.absences, prepared.groups, selectedPeriod)[0] ?? null;
    return { options: periodOptions, selected: selectedPeriod, summary, groups: groupsInPeriod(prepared.groups, selectedPeriod) };
  }, [prepared, granularity, periodOptions, selectedPeriod]);

  // Score geral por dias com check (não depende do período escolhido)
  const dailyScores = useMemo(
    () =>
      buildUserScores(
        (snapshot?.rows ?? []).filter((r) => isActivatedStatus(r.userStatus)),
        snapshot?.weekGroups ?? [],
        snapshot?.absences ?? [],
        snapshot?.legacyGroups ?? []
      ),
    [snapshot]
  );

  return {
    dailyScores,
    snapshot,
    hasData,
    weeks,
    period,
    activeProjects,
    deParaTable,
    loading: loading || (!skip && sessionLoading),
    refreshing,
    error,
    stale,
    skipped,
    fallback,
    refresh: () => load(true),
  };
}
