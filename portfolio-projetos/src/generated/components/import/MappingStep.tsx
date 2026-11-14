import type { ColumnInfo, FieldDef } from '@generated/lib/fields';
import { cn } from '@lib/utils';
import { SearchSelect } from '../SearchSelect';

export function MappingTable({ title, defs, cols, value, onChange }: {
  title: string; defs: FieldDef[]; cols: ColumnInfo[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="divide-y divide-border rounded-md border border-border">
        {defs.map((d) => {
          const col = cols.find((c) => c.id === value[d.key]);
          const typeWarn = col && !d.types.includes(col.type);
          return (
            <div key={d.key} className="grid grid-cols-1 items-center gap-1 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-3">
              <div className="min-w-0 text-sm">
                {d.label}{d.optional && <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>}
                {!value[d.key] && !d.optional && <span className="ml-2 text-[11px] text-[hsl(var(--warn))]">ausente</span>}
                {typeWarn && <span className="ml-2 text-[11px] text-[hsl(var(--warn))]">tipo inesperado</span>}
                {col && <span className="ml-2 rounded-sm bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground" title="Tipo real detectado na coluna">{col.type}</span>}
              </div>
              <SearchSelect
                ariaLabel={`Coluna para ${d.label}`}
                value={value[d.key] ?? ''}
                emptyLabel="— Não mapear —"
                options={cols.map((c) => ({ value: c.id, label: c.title, hint: `${c.type} · ${c.id}` }))}
                onChange={(v) => onChange({ ...value, [d.key]: v })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LabelPicker({ title, hint, labels, value, onChange }: { title: string; hint: string; labels: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      {labels.length === 0 ? <p className="text-xs italic text-muted-foreground">Nenhum rótulo encontrado.</p> : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => {
            const on = value.includes(l);
            return (
              <button key={l} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== l) : [...value, l])}
                className={cn('min-h-9 rounded-md border px-2.5 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>
                {l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
