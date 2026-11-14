import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjects, idsWithStatus } from '@generated/hooks/useProjects';
import { refetchItems } from '@generated/lib/projectsStore';
import { useRunner } from '@generated/hooks/useRunner';
import { Toolbar } from '@generated/components/Toolbar';
import { ProjectTable } from '@generated/components/ProjectTable';
import { RunConsole } from '@generated/components/RunConsole';
import { ProjectsSection, toggleIn, toggleMany } from '@generated/components/ProjectsSection';
import { OrphanNotice } from '@generated/components/OrphanNotice';
import { useOrphanCheck } from '@generated/hooks/useOrphanCheck';

/** Aba "Rodar calculadora". */
export function CalcTab({ onBusyChange, onGoOrphans }) {
  const projects = useProjects();
  const { patchRows } = projects;
  const processed = useRef([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loadingExecutar, setLoadingExecutar] = useState(false);
  const [notice, setNotice] = useState(null);

  const onProjectDone = useCallback((r) => {
    const patch = r.status === 'Erro'
      ? { calculadora: 'Erro' }
      : { calculadora: r.status, riscosGerados: r.total, dataDaLtimaExecuo: new Date(`${r.date}T00:00:00.000Z`) };
    patchRows({ [r.id]: patch });
    processed.current.push(r.id);
  }, [patchRows]);

  const orphans = useOrphanCheck();
  const { check: checkOrphans } = orphans;
  const onFinished = useCallback(() => {
    const ids = processed.current;
    processed.current = [];
    refetchItems(ids);
    checkOrphans();
  }, [checkOrphans]);
  const { run, start, clear } = useRunner({ onProjectDone, onFinished });
  useEffect(() => { onBusyChange?.(run.running); }, [run.running, onBusyChange]);

  const runSelected = () => {
    const ids = [...selected];
    setSelected(new Set());
    setNotice(null);
    start(ids);
  };

  const runExecutar = async () => {
    setNotice(null);
    setLoadingExecutar(true);
    try {
      const ids = await idsWithStatus('calculadora', 'Executar');
      if (!ids.length) setNotice('Nenhum projeto está com a Calculadora em “Executar”.');
      else start(ids);
    } catch (err) {
      console.error('Erro ao buscar projetos em Executar:', err);
      setNotice('Não foi possível buscar os projetos em “Executar”. Tente novamente.');
    } finally {
      setLoadingExecutar(false);
    }
  };

  const executarCount = projects.counts.rows.find((r) => r.value === 'Executar')?.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="min-w-0 space-y-3">
        <Toolbar
          search={projects.search}
          onSearch={projects.setSearch}
          counts={projects.counts}
          statusFilter={projects.statusFilter}
          onStatusFilter={projects.setStatusFilter}
          selectedCount={selected.size}
          executarCount={executarCount}
          running={run.running}
          loadingExecutar={loadingExecutar}
          onRunSelected={runSelected}
          onRunExecutar={runExecutar}
          onClearSelection={() => setSelected(new Set())}
        />
        <OrphanNotice count={run.running ? 0 : orphans.orphanCount} onOpen={onGoOrphans} onDismiss={orphans.dismiss} />
        {(notice || projects.error) && (
          <output className="block rounded-[6px] border border-border bg-card px-4 py-3 text-sm text-foreground">{notice || projects.error}</output>
        )}
        <ProjectsSection
          title="Projetos"
          shownCount={projects.items.length}
          totalCount={projects.filteredCount}
          selectedCount={selected.size}
          hasMore={projects.hasMore}
          onShowMore={projects.showMore}
        >
          <ProjectTable
            items={projects.items}
            loading={projects.loading}
            refetching={projects.refetching}
            selected={selected}
            onToggle={(id) => setSelected((s) => toggleIn(s, id))}
            onTogglePage={(ids, on) => setSelected((s) => toggleMany(s, ids, on))}
            disabled={run.running}
            emptyHint="Ajuste a busca ou o filtro. Novos projetos cadastrados no board 09.1 aparecem aqui."
          />
        </ProjectsSection>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-[64px] lg:self-start">
        <RunConsole run={run} onClear={clear} />
      </aside>
    </div>
  );
}
