import { saturdayAfter } from '@generated/lib/weekPeriod';

const inputCls =
  'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

interface Props {
  idPrefix: string;
  weekStart: string;
  weekEnd: string;
  disabled: boolean;
  onChange: (next: { weekStart: string; weekEnd: string }) => void;
}

/** Início e fim da semana (obrigatórios). Ao escolher o início, o fim vira o sábado seguinte. */
export function WeekPeriodFields({ idPrefix, weekStart, weekEnd, disabled, onChange }: Props) {
  return (
    <>
      <label className="space-y-1.5 text-[11px] font-medium text-foreground block" htmlFor={`${idPrefix}-ws`}>
        <span>Início da semana</span>
        <input
          id={`${idPrefix}-ws`} type="date" required value={weekStart} disabled={disabled} className={inputCls}
          onChange={(e) => onChange({ weekStart: e.target.value, weekEnd: saturdayAfter(e.target.value) ?? '' })}
        />
      </label>
      <label className="space-y-1.5 text-[11px] font-medium text-foreground block" htmlFor={`${idPrefix}-we`}>
        <span>Fim da semana</span>
        <input
          id={`${idPrefix}-we`} type="date" required value={weekEnd} disabled={disabled} className={inputCls}
          onChange={(e) => onChange({ weekStart, weekEnd: e.target.value })}
        />
      </label>
    </>
  );
}
