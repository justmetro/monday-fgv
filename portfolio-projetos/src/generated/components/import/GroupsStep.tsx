import type { GroupInfo, ProjectConfig } from '@generated/lib/fields';
import { cn } from '@lib/utils';
import { SearchSelect } from '../SearchSelect';

type GKey = 'indicatorGroupId' | 'measurementGroupId' | 'scheduleGroupId' | 'productGroupId' | 'riskGroupId';
const ROWS: { key: GKey; label: string; hint: string }[] = [
  { key: 'indicatorGroupId', label: 'Indicadores', hint: 'Indicadores (KR/KPI) do projeto' },
  { key: 'measurementGroupId', label: 'Medição do indicador', hint: 'Medições vinculadas aos indicadores' },
  { key: 'scheduleGroupId', label: 'Cronograma', hint: 'Atividades do cronograma (com subelementos opcionais)' },
  { key: 'productGroupId', label: 'Produtos', hint: 'Produtos, entregas e faturamento' },
  { key: 'riskGroupId', label: 'Riscos', hint: 'Matriz de riscos do projeto' },
];

/** Escolha dos grupos: cada um é opcional ("importar este grupo"). */
export function GroupsStep({ cfg, setCfg, groups, remember, hasSubitems }: {
  cfg: ProjectConfig; setCfg: (c: ProjectConfig) => void; groups: GroupInfo[];
  /** Último grupo escolhido por linha, para reativar a seleção ao remarcar. */
  remember: Record<string, string>; hasSubitems: boolean;
}) {
  const used = ROWS.map((r) => cfg[r.key] ?? '').filter(Boolean);
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {ROWS.map((r) => {
        const val = cfg[r.key] ?? '';
        const on = !!val;
        const dup = on && used.filter((x) => x === val).length > 1;
        return (
          <div key={r.key} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center">
            <label className="flex min-w-0 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" checked={on}
                onChange={(e) => setCfg({ ...cfg, [r.key]: e.target.checked ? remember[r.key] || groups[0]?.id || '' : '' })} />
              <span className="min-w-0"><b className="font-medium">{r.label}</b>
                <span className="block text-xs text-muted-foreground">{on ? r.hint : 'Não importar este grupo'}</span>
                {dup && <span className="block text-xs text-destructive">O mesmo grupo foi escolhido para mais de uma finalidade.</span>}
              </span>
            </label>
            <div className="min-w-0 space-y-2">
              <SearchSelect ariaLabel={`Grupo de ${r.label}`} disabled={!on} value={val} placeholder={on ? 'Selecione ou pesquise…' : '— Não importar —'}
                options={groups.map((g) => ({ value: g.id, label: g.title, hint: g.id }))} onChange={(v) => setCfg({ ...cfg, [r.key]: v })} />
              {r.key === 'scheduleGroupId' && on && (
                <label className={cn('flex items-center gap-2 text-xs', !hasSubitems && 'text-muted-foreground')}>
                  <input type="checkbox" className="size-4" disabled={!hasSubitems} checked={!!cfg.importSubitems && hasSubitems} onChange={(e) => setCfg({ ...cfg, importSubitems: e.target.checked })} />
                  {hasSubitems ? 'Importar subelementos das atividades' : 'Este quadro não tem subelementos'}
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function groupsValid(cfg: ProjectConfig): boolean {
  const ids = ROWS.map((r) => cfg[r.key] ?? '').filter(Boolean);
  return ids.length > 0 && new Set(ids).size === ids.length;
}
