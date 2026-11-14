import { useMemo, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import type { StoredEngagementRow } from '@generated/models';
import { baseRowKey } from '@generated/lib/baseRows';
import { WEEKDAYS, normText } from '@generated/lib/weekdays';

interface Props {
  rows: StoredEngagementRow[];
  onEdit: (rows: StoredEngagementRow[]) => void;
}

const PAGE = 100;

/** Consulta completa da Base com seleção de itens para editar (um ou vários em série). */
export function BaseRowsTable({ rows, onEdit }: Props) {
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState('todos');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => Array.from(new Set(rows.map((r) => r.group ?? '').filter(Boolean))).sort(), [rows]);
  // A Base inteira já está carregada nesta aba, então o filtro abrange todas as linhas
  const filtered = useMemo(() => {
    const q = normText(term);
    return rows
      .filter((r) => group === 'todos' || r.group === group)
      .filter((r) => !q || [r.name, r.email, r.team, r.group].some((v) => normText(v).includes(q)))
      .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.name.localeCompare(b.name));
  }, [rows, term, group]);
  const shown = filtered.slice(0, limit);
  const toggle = (k: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allShown = shown.length > 0 && shown.every((r) => selected.has(baseRowKey(r)));
  const selectedRows = rows.filter((r) => selected.has(baseRowKey(r)));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={term} onChange={(e) => { setTerm(e.target.value); setLimit(PAGE); }} placeholder="Buscar nome, e-mail, equipe…" aria-label="Buscar na Base"
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={group} onChange={(e) => { setGroup(e.target.value); setLimit(PAGE); }} aria-label="Semana" className="h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground">
            <option value="todos">Todas as semanas ({groups.length})</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button type="button" disabled={selectedRows.length === 0} onClick={() => onEdit(selectedRows)}
          className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Editar selecionados ({selectedRows.length})
        </button>
      </div>

      <div className="border border-border rounded-2xl overflow-auto max-h-[500px]">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 w-10">
                <input type="checkbox" aria-label="Selecionar todos os exibidos" checked={allShown}
                  onChange={() => setSelected((prev) => { const n = new Set(prev); shown.forEach((r) => (allShown ? n.delete(baseRowKey(r)) : n.add(baseRowKey(r)))); return n; })} />
              </th>
              <th className="py-2.5 px-3">Pessoa</th>
              <th className="py-2.5 px-3">Semana</th>
              <th className="py-2.5 px-3">Equipe</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Ativo pela última vez</th>
              <th className="py-2.5 px-3">Checks</th>
              <th className="py-2.5 px-3 w-10"><span className="sr-only">Editar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro para os filtros selecionados.</td></tr>
            ) : shown.map((r) => {
              const k = baseRowKey(r);
              return (
                <tr key={k} className="hover:bg-muted/40">
                  <td className="py-2 px-3"><input type="checkbox" aria-label={`Selecionar ${r.name}`} checked={selected.has(k)} onChange={() => toggle(k)} /></td>
                  <td className="py-2 px-3 max-w-[260px]"><div className="font-medium text-foreground break-words">{r.name}</div><div className="text-[11px] text-muted-foreground break-all">{r.email || '—'}</div></td>
                  <td className="py-2 px-3 whitespace-nowrap"><span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">{r.group || '—'}</span></td>
                  <td className="py-2 px-3 text-muted-foreground max-w-[260px] break-words" title={r.team}>{r.team || '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-foreground">{r.lastAccess || '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {(r.checkedDays ?? []).length > 0
                      ? WEEKDAYS.filter((w) => (r.checkedDays ?? []).includes(w.key)).map((w) => (
                        <span key={w.key} className="mr-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]">{w.short}</span>
                      ))
                      : <span className="text-muted-foreground text-[11px]">Nenhum</span>}
                  </td>
                  <td className="py-2 px-3">
                    <button type="button" aria-label={`Editar ${r.name}`} onClick={() => onEdit([r])} className="w-8 h-8 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="h-10 px-4 rounded-xl border border-border text-xs hover:bg-muted">
            Mostrar mais ({filtered.length - limit} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
