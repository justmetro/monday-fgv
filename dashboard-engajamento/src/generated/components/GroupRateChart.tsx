import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { GroupStat } from '@generated/lib/engagementMetrics';

interface Props {
  title: string;
  subtitle: string;
  data: GroupStat[];
  color: string;
  selected?: string;
  onSelect?: (name: string) => void;
  showStatusBadge?: boolean;
}

export function GroupRateChart({
  title,
  subtitle,
  data,
  color,
  selected = 'all',
  onSelect,
  showStatusBadge = false,
}: Props) {
  const rows = data.slice(0, 15);
  const height = Math.max(180, rows.length * 36 + 40);

  return (
    <div className="bg-card rounded-lg p-5 soft-stack-card min-w-0 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-normal tracking-[-0.025em] text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {selected !== 'all' && onSelect && (
            <button
              onClick={() => onSelect('all')}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Ver todos
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            Nenhum dado encontrado para o filtro selecionado.
          </p>
        ) : (
          <div className="mt-4 w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: string) => {
                    if (val.length > 22) return `${val.slice(0, 20)}...`;
                    return val;
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  formatter={(_v, _n, item) => {
                    const p = item?.payload as GroupStat | undefined;
                    const managersStr = p?.projectInfo?.managers?.length
                      ? ` | Gerente: ${p.projectInfo.managers.join(', ')}`
                      : '';
                    const statusStr = p?.projectInfo?.status ? ` [${p.projectInfo.status}]` : '';
                    return [
                      `${p?.rate ?? 0}% (${p?.engaged ?? 0} de ${p?.total ?? 0} pessoas)${statusStr}${managersStr}`,
                      'Engajamento',
                    ];
                  }}
                />
                <Bar
                  dataKey="rate"
                  fill={color}
                  radius={[0, 2, 2, 0]}
                  barSize={14}
                  minPointSize={2}
                  onClick={(d) => {
                    const name = (d as { name?: string } | undefined)?.name;
                    if (name && onSelect) {
                      onSelect(name === selected ? 'all' : name);
                    }
                  }}
                  className={onSelect ? 'cursor-pointer' : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showStatusBadge && rows.some((r) => r.projectInfo) && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span>• Apenas projetos ativos ({rows.length})</span>
          <span>• Metadados cruzados com o Histórico de Projetos</span>
        </div>
      )}
    </div>
  );
}
