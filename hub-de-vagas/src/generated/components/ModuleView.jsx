import { useMemo, useState, useCallback } from 'react';
import { desalocInfo, SITU, vagaPrazo } from '@generated/lib/esteira';
import { SearchX } from 'lucide-react';
import ControlBar from '@generated/components/ControlBar';
import { FilterChips } from '@generated/components/FilterMenu';
import GroupTree from '@generated/components/views/GroupTree';
import DataTable from '@generated/components/views/DataTable';
import VagaMatches from '@generated/components/views/VagaMatches';
import CardsView from '@generated/components/views/CardsView';
import PdfButton from '@generated/components/PdfButton';
import KanbanView from '@generated/components/views/KanbanView';
import TimelineView from '@generated/components/views/TimelineView';
import MatrixView from '@generated/components/views/MatrixView';
import VagaGanttView from '@generated/components/views/VagaGanttView';
import { resolveField, withPreset, VAGA_GROUP } from '@generated/lib/modules';
import { matchesFilters, matchesSearch, sortItems, buildTree, collectIds } from '@generated/lib/engine';
import { normText } from '@generated/lib/data';
import { exportView } from '@generated/lib/exporter';

const ENTITY = { vagas: 'vaga', perfis: 'perfil', progs: 'prog' };
const STATUS_KEY = { vagas: 'statusDaVaga', perfis: 'statusDoPerfil', progs: 'statusProgresso' };
const SUBTITLE = {
  vagas: (i) => [`Cód. ${i.id}`, i.projeto, i.cargoPapel].filter(Boolean).join(' · '),
  perfis: (i) => [i.papelDeOrigem, i.gerenteDeOrigem].filter(Boolean).join(' · '),
  progs: (i) => [i.projetoReaDeAtuao, i.gerentegestoraResponsvelPelaSolicitao].filter(Boolean).join(' · '),
};
const TONE = {
  vagas: (i) => (vagaPrazo(i) === 'Atrasada' ? 'danger' : null),
  perfis: (i) => { const s = desalocInfo(i)?.situ; return s === SITU.ocioso ? 'danger' : s === SITU.tolerancia ? 'warn' : null; },
  progs: () => null,
};

export default function ModuleView({ mod, state, setState, data, onOpen, saved, onApplySaved }) {
  const set = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [setState]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const items = data[mod.id];
  const entity = ENTITY[mod.id];
  const term = normText(state.search.trim().replace(/^(#|c[oó]d\.?\s*)/i, ''));

  const filtered = useMemo(() => {
    const resolve = (k) => resolveField(mod, k);
    const searchFields = mod.searchKeys.map((k) => mod.fmap[k]);
    const mf = Object.fromEntries(Object.entries(state.mfilters ?? {}).filter(([, v]) => v?.length));
    const hasMf = Object.keys(mf).length > 0;
    const out = [];
    items.forEach((it) => {
      if (!matchesFilters(it, state.filters, resolve)) return;
      const hit = matchesSearch(it, term, searchFields);
      if (mod.id === 'vagas') {
        let ms = hasMf ? it._matches.filter((m) => matchesFilters(m, mf, (k) => mod.mfmap[k])) : it._matches;
        if (!hit && term) ms = ms.filter((m) => normText(m._pessoa).includes(term) || normText(m.name).includes(term));
        if ((hasMf || (!hit && term)) && !ms.length) return;
        out.push({ ...it, _visibleMatches: ms });
      } else if (hit || (mod.id === 'perfis' && it._matches.some((m) => normText(m._vagaName).includes(term)))) {
        out.push(it);
      }
    });
    const sort = state.sort ?? { key: 'name', dir: 'asc' };
    return sortItems(out, sort, mod.fmap[sort.key]);
  }, [items, mod, state.filters, state.mfilters, state.sort, term]);

  const groupBy = state.groupBy ?? [];
  const vagaMode = mod.id === 'vagas' && groupBy.includes(VAGA_GROUP);
  const levelsKey = groupBy.filter((k) => k !== VAGA_GROUP).join('|');
  const levels = useMemo(() => (levelsKey ? levelsKey.split('|').map((k) => mod.fmap[k]).filter(Boolean) : []), [levelsKey, mod]);
  const tree = useMemo(() => buildTree(filtered, levels), [filtered, levels]);
  const columns = (state.columns ?? mod.defaultColumns).map((k) => mod.fmap[k]).filter(Boolean);
  const visibleMatches = useMemo(() => (mod.id === 'vagas' ? filtered.flatMap((v) => v._visibleMatches) : []), [filtered, mod.id]);

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const collapseAll = () => setCollapsed(new Set([...collectIds(tree), ...(vagaMode ? filtered.map((v) => `vaga:${v.id}`) : [])]));
  const onSort = (key) => set({ sort: state.sort?.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' } });
  const open = (it) => onOpen(entity, it);

  const action = mod.id === 'perfis' ? (it) => <PdfButton id={it.id} size="sm" /> : undefined;
  const renderLeaf = (list) => {
    if (state.view === 'cards') {
      return <CardsView items={list} fields={mod.cardFields.map((k) => mod.fmap[k])} subtitle={SUBTITLE[mod.id]} tone={TONE[mod.id]} onOpen={open} action={action}
        footer={(it) => (it._matches ? <div className="text-xs text-muted-foreground">{(it._visibleMatches ?? it._matches).length} {mod.id === 'perfis' ? 'vagas em match' : 'matches'}</div> : null)} />;
    }
    if (vagaMode) return <VagaMatches vagas={list} collapsed={collapsed} toggle={toggle} onOpen={onOpen} />;
    return <DataTable columns={columns} rows={list} sort={state.sort ?? { key: 'name', dir: 'asc' }} onSort={onSort} onRowClick={open} rowTone={TONE[mod.id]} action={action} />;
  };

  const kanbanKey = state.kanbanBy ?? mod.kanbanKeys[0];
  const kanbanMatch = kanbanKey.startsWith('m:');
  const dateField = mod.fmap[state.dateKey ?? mod.dateKeys[0]];

  let body;
  if (!filtered.length) {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-16 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Nada encontrado com essa combinação de filtros.</p>
        <button onClick={() => set({ filters: {}, mfilters: {}, search: '', presetId: null })} className="rounded-full border border-input px-4 py-1.5 text-sm hover:border-primary/50">Limpar filtros</button>
      </div>
    );
  } else if (state.view === 'kanban') {
    body = kanbanMatch
      ? <KanbanView items={visibleMatches} field={mod.mfmap[kanbanKey.slice(2)]} onOpen={(m) => onOpen('match', m)} subtitle={(m) => m._vagaName} badgeKey="resultadoDaRodada" />
      : <KanbanView items={filtered} field={mod.fmap[kanbanKey]} onOpen={open} subtitle={SUBTITLE[mod.id]} />;
  } else if (state.view === 'matrix' && mod.id === 'vagas') {
    body = <MatrixView vagas={filtered} byId={data.byId} onOpenMatch={(m) => onOpen('match', m)}
      onOpenVaga={(id) => data.byId[id] && onOpen('vaga', data.byId[id].item)} onOpenPerfil={(id) => data.byId[id] && onOpen('perfil', data.byId[id].item)} />;
  } else if (state.view === 'timeline' && mod.id === 'vagas') {
    body = <VagaGanttView vagas={filtered} onOpen={open} zoom={state.tlZoom ?? 'week'} setZoom={(z) => set({ tlZoom: z })} />;
  } else if (state.view === 'timeline') {
    body = <TimelineView items={filtered} dateField={dateField} statusKey={STATUS_KEY[mod.id]} subtitle={SUBTITLE[mod.id]} onOpen={open} />;
  } else if (tree) {
    body = <GroupTree nodes={tree} collapsed={collapsed} toggle={toggle} renderLeaf={renderLeaf} countLabel={mod.noun} />;
  } else {
    body = renderLeaf(filtered);
  }

  return (
    <div className="flex flex-col gap-4">
      <ControlBar mod={mod} state={state} set={set} items={items} matches={data.matches}
        onPreset={(id) => setState(withPreset(mod.id, id))} saved={saved} onApplySaved={onApplySaved}
        onExpand={() => setCollapsed(new Set())} onCollapse={collapseAll}
        onExport={() => exportView({ mod, state, filtered, columns, vagaMode, kanbanMatch, visibleMatches })} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips mod={mod} state={state} set={set} />
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {filtered.length} {mod.noun}{mod.id === 'vagas' ? ` · ${visibleMatches.length} matches` : ''}
        </span>
      </div>
      {body}
    </div>
  );
}
