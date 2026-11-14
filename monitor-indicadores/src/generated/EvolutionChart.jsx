import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, LabelList } from 'recharts';
import { fmtPct } from '@generated/lib';
import { Tip, MedTip, Marker } from '@generated/tip';

const GOAL = 'hsl(var(--goal))';

export default function EvolutionChart({ data, meta, lower, code, un, height = 'h-72', title = 'Evolução mensal', onPoint }) {
  const Dot = ({ cx, cy, payload }) => cx == null ? null : (
    <Tip content={<MedTip code={code} un={un} label={payload.long ?? payload.label} r={payload.r ?? payload} />}>
      <Marker cx={cx} cy={cy} r={7} apurado={payload.apurado} meta={payload.meta ?? meta} lower={lower} parcial={payload.r?.parcial}
        style={{ cursor: onPoint ? 'pointer' : 'default' }} onClick={() => onPoint?.(payload)} />
    </Tip>
  );
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {data.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">Nenhuma medição no período.</p> : (
        <div className={`mt-3 ${height}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 24, right: 70, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 13, fill: GOAL }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: GOAL }} axisLine={false} tickLine={false} width={44} />
              {meta != null && <ReferenceLine y={meta} stroke={GOAL} strokeDasharray="6 4" label={{ value: `Meta ${fmtPct(meta)}`, position: 'right', fill: GOAL, fontSize: 12, fontWeight: 600 }} />}
              <Line type="linear" dataKey="apurado" stroke="hsl(var(--foreground) / 0.5)" strokeWidth={2} dot={<Dot />} activeDot={false} isAnimationActive={false}>
                <LabelList dataKey="apurado" position="top" formatter={(v) => fmtPct(v)} style={{ fontSize: 13, fontWeight: 700, fill: 'hsl(var(--foreground))' }} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
