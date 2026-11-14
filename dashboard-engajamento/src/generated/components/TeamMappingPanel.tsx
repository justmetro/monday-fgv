import { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Trash2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  addTeamMapping,
  deleteTeamMapping,
  updateTeamMapping,
  type EngagementSnapshotView,
} from '@generated/server/storage';
import { NOT_A_PROJECT_FLAG, normalizeName } from '@generated/lib/projectMatcher';
import { useUserSession } from '@generated/hooks/useUserSession';
import { SearchableSelect, type ComboboxOption } from './SearchableSelect';
import { filterActiveProjects } from '@generated/lib/activeProjects';
import { ReimportNotice } from './ReimportNotice';
import { TeamMappingStats } from './TeamMappingStats';
import { teamMappingStats } from '@generated/lib/teamMappingStats';

export interface UnmatchedTeam {
  teamName: string;
  peopleCount: number;
}

interface Props {
  snapshot: EngagementSnapshotView;
  unmatched: UnmatchedTeam[];
  onChanged: () => void;
}

export function TeamMappingPanel({ snapshot, unmatched, onChanged }: Props) {
  const { session } = useUserSession();
  const activeProjectsList = useMemo(() => filterActiveProjects(snapshot.projects), [snapshot.projects]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newTarget, setNewTarget] = useState('');
  // Cópia local das linhas: os contadores se recalculam na hora ao adicionar, editar ou remover
  const [rowsState, setRowsState] = useState(snapshot.deParaRows);
  useEffect(() => setRowsState(snapshot.deParaRows), [snapshot.deParaRows]);
  const [outsideOnly, setOutsideOnly] = useState(false);
  const stats = useMemo(() => teamMappingStats(activeProjectsList, rowsState), [activeProjectsList, rowsState]);

  const upsertLocal = (equipe: string, projeto: string, id: string) =>
    setRowsState((cur) => {
      const k = normalizeName(equipe);
      const has = cur.some((r) => normalizeName(r.equipe) === k);
      return has ? cur.map((r) => (normalizeName(r.equipe) === k ? { ...r, projeto } : r)) : [...cur, { id, equipe, projeto }];
    });
  const addFromProject = async (projeto: string, equipe: string): Promise<boolean> => {
    const key = `proj:${projeto}`;
    setBusyKey(key);
    setMessage(null);
    try {
      const res = await addTeamMapping({ data: { equipe, projeto, clientClaim } });
      upsertLocal(equipe, projeto, res?.id ?? `tmp_${equipe}`);
      setMessage({ ok: true, text: `“${equipe}” adicionada ao projeto.` });
      onChanged();
      return true;
    } catch (e) {
      console.error(e);
      setMessage({ ok: false, text: (e as Error).message || 'Não foi possível salvar.' });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const clientClaim = session?.email
    ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
    : undefined;

  const projectNames = useMemo(
    () => activeProjectsList.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
    [activeProjectsList]
  );

  const getSelectOptions = (current?: string): ComboboxOption[] => {
    const list: ComboboxOption[] = [
      { value: NOT_A_PROJECT_FLAG, label: 'Não é projeto' },
      ...projectNames.map((p) => ({ value: p, label: p })),
    ];
    if (current && !list.some((o) => normalizeName(o.value) === normalizeName(current))) {
      list.push({ value: current, label: `${current} (não está entre os ativos)` });
    }
    return list;
  };

  const act = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    setBusyKey(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: okText });
      onChanged();
    } catch (e) {
      console.error(e);
      setMessage({ ok: false, text: (e as Error).message || 'Não foi possível salvar.' });
    } finally {
      setBusyKey(null);
    }
  };

  const outsideIds = new Set(stats.outsideRows.map((r) => r.id));
  const rows = rowsState.filter((r) => {
    if (outsideOnly && !outsideIds.has(r.id)) return false;
    const q = normalizeName(search);
    return !q || normalizeName(r.equipe).includes(q) || normalizeName(r.projeto).includes(q);
  });

  return (
    <>
      <ReimportNotice needed={Boolean(snapshot.projectsInfo?.needsReimport)} />
      <TeamMappingStats
        activeProjects={activeProjectsList}
        withTeamCount={stats.withTeam.length}
        withoutTeam={stats.withoutTeam}
        outsideCount={stats.outsideRows.length}
        info={snapshot.projectsInfo}
        outsideFilter={outsideOnly}
        onToggleOutside={() => setOutsideOnly((v) => !v)}
        onAddTeam={addFromProject}
        busyKey={busyKey}
      />
      <section className="bg-card rounded-lg p-6 border border-border space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-base font-medium text-foreground">Equipes sem projeto (candidatas com colchetes)</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Equipes com colchetes sem correspondência exata. Pesquise e escolha o projeto ativo correspondente ou “Não é projeto”. A escolha é salva na tabela de-para e valerá para as próximas importações.
          </p>
        </div>

        {unmatched.length === 0 ? (
          <p className="p-4 rounded-lg bg-muted/40 border border-border text-xs text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Todas as equipes candidatas com colchetes estão mapeadas.
          </p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border max-h-96 overflow-y-auto">
            {unmatched.map((u) => (
              <div key={u.teamName} className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center text-xs">
                <div className="md:col-span-5 font-medium text-foreground break-words">{u.teamName}</div>
                <div className="md:col-span-2 text-muted-foreground tabular-nums">{u.peopleCount} pessoa(s)</div>
                <div className="md:col-span-5">
                  <SearchableSelect
                    ariaLabel={`Projeto da equipe ${u.teamName}`}
                    placeholder="Pesquisar e escolher projeto..."
                    searchPlaceholder="Buscar projeto ativo..."
                    value=""
                    showAllOption={false}
                    disabled={busyKey === u.teamName}
                    options={getSelectOptions()}
                    onChange={(selectedProject) => {
                      if (selectedProject) {
                        void act(
                          u.teamName,
                          () =>
                            addTeamMapping({
                              data: { equipe: u.teamName, projeto: selectedProject, clientClaim },
                            }),
                          `“${u.teamName}” salva no de-para.`
                        );
                      }
                    }}
                    className="w-full"
                    buttonClassName="w-full h-9 min-w-0"
                    dropdownClassName="w-full sm:w-96"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card rounded-lg p-6 border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-foreground">Tabela de-para Equipe → Projeto ativo</h3>
            <p className="text-xs text-muted-foreground mt-1">Única fonte da ligação entre equipes e projetos. O casamento é estrito por igualdade.</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no de-para..."
              aria-label="Buscar no de-para"
              className="h-9 w-full sm:w-56 text-xs pl-8 pr-2 rounded border border-border bg-background text-foreground"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/40 border border-border flex flex-col md:flex-row gap-2 md:items-center">
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="Nome completo da equipe (ex: [MA] SEMAG)"
            aria-label="Nome da equipe"
            className="md:w-1/3 h-9 text-xs px-3 rounded border border-border bg-background text-foreground"
          />
          <div className="md:flex-1 min-w-0">
            <SearchableSelect
              ariaLabel="Projeto da nova linha"
              placeholder="Pesquisar e escolher projeto..."
              searchPlaceholder="Buscar projeto ativo..."
              value={newTarget}
              showAllOption={false}
              options={getSelectOptions()}
              onChange={(val) => setNewTarget(val)}
              className="w-full"
              buttonClassName="w-full h-9 min-w-0"
              dropdownClassName="w-full sm:w-96"
            />
          </div>
          <button
            disabled={!newTeam.trim() || !newTarget || busyKey === '__new__'}
            onClick={() =>
              void act('__new__', async () => {
                const res = await addTeamMapping({ data: { equipe: newTeam.trim(), projeto: newTarget, clientClaim } });
                upsertLocal(newTeam.trim(), newTarget, res?.id ?? `tmp_${newTeam.trim()}`);
                setNewTeam('');
                setNewTarget('');
              }, 'Linha adicionada.')
            }
            className="h-9 px-4 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>

        {outsideOnly && (
          <p className="text-xs text-foreground flex items-center gap-2">
            Mostrando só os mapeamentos para projeto fora dos ativos ({rows.length}).
            <button type="button" onClick={() => setOutsideOnly(false)} className="underline text-primary">Mostrar todas as linhas</button>
          </p>
        )}

        {message && (
          <p className={`text-xs flex items-center gap-1.5 ${message.ok ? 'text-foreground' : 'text-destructive'}`}>
            {message.ok ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertCircle className="w-4 h-4" />} {message.text}
          </p>
        )}

        <div className="border border-border rounded-lg divide-y divide-border max-h-[28rem] overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center text-xs">
              <div className="md:col-span-5 font-medium text-foreground break-words">{r.equipe}</div>
              <div className="md:col-span-6">
                <SearchableSelect
                  ariaLabel={`Projeto da equipe ${r.equipe}`}
                  placeholder="Pesquisar e escolher projeto..."
                  searchPlaceholder="Buscar projeto..."
                  value={r.projeto}
                  showAllOption={false}
                  disabled={busyKey === r.id}
                  options={getSelectOptions(r.projeto)}
                  onChange={(selectedVal) => {
                    if (selectedVal) {
                      void act(
                        r.id,
                        async () => {
                          await updateTeamMapping({ data: { id: r.id, equipe: r.equipe, projeto: selectedVal, clientClaim } });
                          setRowsState((cur) => cur.map((x) => (x.id === r.id ? { ...x, projeto: selectedVal } : x)));
                        },
                        `“${r.equipe}” atualizada.`
                      );
                    }
                  }}
                  className="w-full"
                  buttonClassName="w-full h-9 min-w-0"
                  dropdownClassName="w-full sm:w-96"
                />
              </div>
              <div className="md:col-span-1 md:text-right">
                <button
                  aria-label={`Remover linha da equipe ${r.equipe}`}
                  disabled={busyKey === r.id}
                  onClick={() => void act(r.id, async () => {
                    await deleteTeamMapping({ data: { id: r.id, clientClaim } });
                    setRowsState((cur) => cur.filter((x) => x.id !== r.id));
                  }, `“${r.equipe}” removida.`)}
                  className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-destructive rounded hover:bg-muted"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma linha encontrada.</p>}
        </div>
      </section>
    </>
  );
}
