import type { ReactNode } from 'react';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';

/** Progress ring (0–100) — presentation only; the value comes from the existing metrics. */
export function Anel({ valor, size = 76, espessura = 8, label, children }: {
  valor: number | null; size?: number; espessura?: number; label: string; children?: ReactNode;
}) {
  const v = valor === null ? 0 : Math.max(0, Math.min(100, valor));
  // Negative values: empty ring on a reddish track, so it doesn't read as "sem dados".
  const negativo = valor !== null && valor < 0;
  return (
    <div className="relative shrink-0" role="img" aria-label={label}>
      <RadialBarChart width={size} height={size} data={[{ v }]} startAngle={90} endAngle={-270}
        innerRadius={size / 2 - espessura} outerRadius={size / 2} barSize={espessura} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="v" cornerRadius={espessura / 2} fill="hsl(var(--primary))" background={{ fill: negativo ? 'hsl(var(--danger) / 0.15)' : 'hsl(var(--surface-3))' }}
          isAnimationActive={false} />
      </RadialBarChart>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
