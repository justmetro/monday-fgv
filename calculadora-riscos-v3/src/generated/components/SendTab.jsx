import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjects, idsWithStatus } from '@generated/hooks/useProjects';
import { refetchItems, loadMeta, getState } from '@generated/lib/projectsStore';
import { useSender } from '@generated/hooks/useSender';
import { useSendMeta } from '@generated/hooks/useSendMeta';
import { Toolbar } from '@generated/components/Toolbar';
import { SendTable } from '@generated/components/SendTable';
import { SendConsole } from '@generated/components/SendConsole';
import { ProjectsSection, toggleIn, toggleMany } from '@generated/components/ProjectsSection';
import { OrphanNotice } from '@generated/components/OrphanNotice';
import { useOrphanCheck } from '@generated/hooks/useOrphanCheck';

const OPTIONS = { columns: ['linkDoPlanejamento', 'envioAoPlanejamento'], statusColumn: 'envioAoPlanejamento' };

/** Aba "Enviar ao planejamento". */
export function SendTab({ onBusyChange, onGoOrphans }) {
  const projects = useProjects(OPTIONS);
  const { patchRows } = projects;
  const processed = useRef([]);
  const { meta, pending } = useSendMeta();
  const [selected, setSelected] = useState(() => new Set());
  const [loadingEnviar, setLoadingEnviar] = useState(false);
  const [notice, setNotice] = useState(null);

  const onProjectDone = useCallback((r) => {
    patchRows({ [r.id]: { envioAoPlanejamento: r.status === 'Erro' ? 'Erro' : 'Enviado' } });
    processed.current.push(r.id);
  }, [patchRows]);

  const orphans = useOrphanCheck();
  const { check: checkOrphans } = orphans;
  const onFinished = useCallback(() => {
    const ids = processed.current;
    processed.current = [];
    if (ids.length) {
      refetchItems(ids).then(() => {
        const set = new Set(ids);
        return loadMeta(getState().items.filter((it) => set.has(it.id)));
      }).catch((err) => console.error('Erro ao atualizar dados dos projetos enviados:', err));
    }
    checkOrphans();
  }, [checkOrphans]);
  const { run, start, clear } = useSender({ onProjectDone, onFinished });
  useEffect(() => { onBusyChange?.(run.running); }, [run.running, onBusyChange]);

  const sendSelected = () => {
    const ids = [...selected];
    setSelected(new Set());
    setNotice(null);
    start(ids);
  };

  const sendMarked = async () => {
    setNotice(null);
    setLoadingEnviar(true);
    try {
      const ids = await idsWithStatus('envioAoPlanejamento', 'Enviar');
      if (!ids.length) setNotice('Nenhum projeto está com o envio marcado como “Enviar”.');
      else start(ids);
    } catch (err) {
      console.error('Erro ao buscar projetos marcados como Enviar:', err);
      setNotice('Não foi possível buscar os projetos marcados como “Enviar”. Tente novamente.');
    } finally {
      setLoadingEnviar(false);
    }
  };

  const enviarCount = projects.counts.rows.find((r) => r.value === 'Enviar')?.count ?? 0;

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
          executarCount={enviarCount}
          running={run.running}
          loadingExecutar={loadingEnviar}
          onRunSelected={sendSelected}
          onRunExecutar={sendMarked}
          onClearSelection={() => setSelected(new Set())}
          primaryLabel="Enviar selecionados ao planejamento"
          secondaryLabel="Enviar todos marcados como “Enviar”"
          filterLabel="Filtrar por status do envio ao planejamento"
        />
        <OrphanNotice count={run.running ? 0 : orphans.orphanCount} onOpen={onGoOrphans} onDismiss={orphans.dismiss} />
        {(notice || projects.error) && (
          <output className="block rounded-[6px] border border-border bg-card px-4 py-3 text-sm text-foreground">{notice || projects.error}</output>
        )}
        <ProjectsSection
          title="Projetos e quadros de planejamento"
          shownCount={projects.items.length}
          totalCount={projects.filteredCount}
          selectedCount={selected.size}
          hasMore={projects.hasMore}
          onShowMore={projects.showMore}
        >
          <SendTable
            items={projects.items}
            loading={projects.loading}
            refetching={projects.refetching}
            selected={selected}
            onToggle={(id) => setSelected((s) => toggleIn(s, id))}
            onTogglePage={(ids, on) => setSelected((s) => toggleMany(s, ids, on))}
            disabled={run.running}
            meta={meta}
            pending={pending}
          />
        </ProjectsSection>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-[64px] lg:self-start">
        <SendConsole run={run} onClear={clear} />
      </aside>
    </div>
  );
}
