import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { StoredEngagementRow } from '@generated/models';
import { baseRowKey } from '@generated/lib/baseRows';
import { WEEKDAYS, sortDays } from '@generated/lib/weekdays';

export interface RowEdit {
  key: string;
  lastAccess: string | null;
  team: string;
  department: string;
  userStatus: string;
  checkedDays: string[];
}

interface Props {
  rows: StoredEngagementRow[];
  saving: boolean;
  onClose: () => void;
  onSave: (edits: RowEdit[], token: string) => void;
}

const inputCls = 'w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const toEdit = (r: StoredEngagementRow): RowEdit => ({
  key: baseRowKey(r), lastAccess: r.lastAccess, team: r.team, department: r.department, userStatus: r.userStatus ?? '', checkedDays: sortDays(r.checkedDays ?? []),
});

/** Edita um ou vários itens em série; nada é gravado antes da confirmação final. */
export function BaseEditDialog({ rows, saving, onClose, onSave }: Props) {
  const [edits, setEdits] = useState<RowEdit[]>(() => rows.map(toEdit));
  const [idx, setIdx] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const token = 'app';
  const row = rows[idx];
  const edit = edits[idx];
  if (!row || !edit) return null;

  const original = rows.map(toEdit);
  const changed = edits.filter((e, i) => JSON.stringify(e) !== JSON.stringify(original[i]));
  const patch = (p: Partial<RowEdit>) => setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, ...p } : e)));
  const toggleDay = (d: string) =>
    patch({ checkedDays: sortDays(edit.checkedDays.includes(d) ? edit.checkedDays.filter((x) => x !== d) : [...edit.checkedDays, d]) });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {reviewing ? 'Confirmar alterações' : `Editar item ${idx + 1} de ${rows.length}`}
            </p>
            <h3 className="text-base font-semibold text-foreground truncate">{reviewing ? `${changed.length} itens alterados` : row.name}</h3>
            {!reviewing && <p className="text-xs text-muted-foreground truncate">{row.email || 'sem e-mail'} · {row.group}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-full hover:bg-muted grid place-items-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {reviewing ? (
          <div className="space-y-3">
            <ul className="text-xs space-y-1.5 max-h-72 overflow-y-auto">
              {changed.length === 0 ? <li className="text-muted-foreground">Nenhuma alteração.</li> : changed.map((e) => {
                const r = rows.find((x) => baseRowKey(x) === e.key);
                const o = r ? toEdit(r) : null;
                const diffs = o ? [
                  o.lastAccess !== e.lastAccess && `último acesso: ${o.lastAccess || '—'} → ${e.lastAccess || '—'}`,
                  o.checkedDays.join(',') !== e.checkedDays.join(',') && `checks: ${o.checkedDays.join(', ') || 'nenhum'} → ${e.checkedDays.join(', ') || 'nenhum'}`,
                  o.team !== e.team && `equipe: ${o.team || '—'} → ${e.team || '—'}`,
                  o.department !== e.department && `departamento: ${o.department || '—'} → ${e.department || '—'}`,
                  o.userStatus !== e.userStatus && `status: ${o.userStatus || '—'} → ${e.userStatus || '—'}`,
                ].filter(Boolean) : [];
                return <li key={e.key} className="rounded-xl bg-muted/50 px-3 py-2 break-words"><span className="font-medium text-foreground">{r?.name}</span> <span className="text-muted-foreground">· {r?.group} · {diffs.join(' · ')}</span></li>;
              })}
            </ul>
            <p className="text-xs text-muted-foreground">Primeiro grava na Base; depois envia ao quadro com o seu login no monday e confere lendo de volta.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1 text-xs font-medium text-foreground">Ativo pela última vez
              <input className={inputCls} value={edit.lastAccess ?? ''} onChange={(e) => patch({ lastAccess: e.target.value })} placeholder="DD/MM/AAAA" />
            </label>
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Checks da semana</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = edit.checkedDays.includes(w.key);
                  return (
                    <button key={w.key} type="button" onClick={() => toggleDay(w.key)} aria-pressed={on}
                      className={`h-10 min-w-[52px] px-2 rounded-xl text-xs font-medium border ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block space-y-1 text-xs font-medium text-foreground">Equipe
              <input className={inputCls} value={edit.team} onChange={(e) => patch({ team: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs font-medium text-foreground">Departamento
                <input className={inputCls} value={edit.department} onChange={(e) => patch({ department: e.target.value })} />
              </label>
              <label className="block space-y-1 text-xs font-medium text-foreground">Status do usuário
                <input className={inputCls} value={edit.userStatus} onChange={(e) => patch({ userStatus: e.target.value })} />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          {reviewing ? (
            <button type="button" onClick={() => setReviewing(false)} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted">Voltar</button>
          ) : (
            <div className="flex gap-1">
              <button type="button" aria-label="Item anterior" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="h-10 w-10 rounded-xl border border-border grid place-items-center disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" aria-label="Próximo item" disabled={idx >= rows.length - 1} onClick={() => setIdx(idx + 1)} className="h-10 w-10 rounded-xl border border-border grid place-items-center disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          {reviewing ? (
            <button type="button" disabled={saving || changed.length === 0} onClick={() => onSave(changed, token)} className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar e gravar
            </button>
          ) : idx < rows.length - 1 ? (
            <button type="button" onClick={() => setIdx(idx + 1)} className="h-10 px-4 rounded-xl bg-muted text-xs font-medium text-foreground">Próximo</button>
          ) : (
            <button type="button" onClick={() => setReviewing(true)} className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium">Revisar alterações</button>
          )}
        </div>
      </div>
    </div>
  );
}
