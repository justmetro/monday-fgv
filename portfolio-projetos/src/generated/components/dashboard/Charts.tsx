import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import type { MeasurementDoc } from '@generated/models';
import type { Model, Slice } from '@generated/lib/metrics';
import { typeKind } from '@generated/lib/format';
import { Panel, SectionTitle } from '../ui-bits';
import type { Drill } from './DrillSheet';

const C = (n: number) => `hsl(var(--chart-${n}))`;
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 } };

function Slide({ options, value, onChange, label }: { options: [string, string]; value: 0 | 1; onChange: (v: 0 | 1) => void; label: string }) {
  return (
    <span role="radiogroup" aria-label={label} className="relative inline-grid grid-cols-2 rounded-full border border-border bg-muted p-0.5 text-xs font-medium">
      <span aria-hidden className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-200 ${value === 1 ? 'translate-x-full' : ''}`} />
      {options.map((opt, i) => (
        <button key={opt} role="radio" aria-checked={value === i} onClick={() => onChange(i === 1 ? 1 : 0)}
          className={`relative z-10 min-h-8 rounded-full px-4 transition-colors ${value === i ? 'text-foreground' : 'text-muted-foreground'}`}>{opt}</button>
      ))}
    </span>
  );
}


export function Charts({ model, s, onDrill }: { model: Model; s: Slice; onDrill: (d: Drill) => void }) {
  const [byMonth, setByMonth] = useState(true);
  const [incView, setIncView] = useState(false);
  const kindOf = (m: MeasurementDoc) => typeKind(model.indicatorsOf(m)[0]?.tipo ?? null);
  const KINDS = [{ k: 'KR', label: 'KR', color: 'hsl(var(--kr))' }, { k: 'KPI', label: 'KPI', color: 'hsl(var(--kpi))' }, { k: 'OUTRO', label: 'Outros', color: C(5) }] as const;
  const metaByType = KINDS.map((t) => {
    const items = s.evaluated.filter((m) => kindOf(m) === t.k);
    const ok = items.filter((m) => model.goalClass(m) === 'reached');
    const no = items.filter((m) => model.goalClass(m) === 'notReached');
    return { name: t.label, Alcançada: ok.length, 'Não alcançada': no.length, sets: { Alcançada: ok, 'Não alcançada': no } };
  }).filter((r) => r.Alcançada + r['Não alcançada'] > 0);
  const GREY = 'hsl(var(--muted-foreground) / 0.45)';
  const weekStart = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const bucket = (iso: string) => (byMonth ? iso.slice(0, 7) : weekStart(iso));
  const label = (w: string) => (byMonth ? `${MESES[Number(w.slice(5, 7)) - 1] ?? ''}/${w.slice(2, 4)}` : `${w.slice(8, 10)}/${w.slice(5, 7)}/${w.slice(2, 4)}`);
  const weekMap = new Map<string, MeasurementDoc[]>();
  s.meds.forEach((m) => { if (m.prazo) { const w = bucket(m.prazo); weekMap.set(w, [...(weekMap.get(w) ?? []), m]); } });
  const weeks = [...weekMap.keys()].sort().map((w) => {
    const items = weekMap.get(w) ?? [];
    const conc = items.filter((m) => model.isConcluded(m));
    const late = items.filter((m) => s.late.includes(m));
    const pend = items.filter((m) => !conc.includes(m) && !late.includes(m));
    return { w, name: label(w), Concluídas: conc.length, Atrasadas: late.length, Pendentes: pend.length, sets: { Concluídas: conc, Atrasadas: late, Pendentes: pend } };
  });
  const noPrazo = s.meds.filter((m) => !m.prazo).length;
  const perProject = s.projs.map((p) => {
    const f = (l: MeasurementDoc[]) => l.filter((m) => m.projectBoardId === p.boardId);
    return { id: p.boardId, name: p.name.length > 28 ? `${p.name.slice(0, 28)}…` : p.name, Previstas: f(s.meds).length, Concluídas: f(s.concluded).length, Atrasadas: f(s.late).length, full: p.name };
  });

  const issueKeys = new Set(s.issues.filter((i) => i.entity === 'medicao').map((i) => `${i.projectBoardId}:${i.itemId}`));
  const incSets = (id: string) => {
    const pm = s.meds.filter((m) => m.projectBoardId === id);
    return {
      'Sem base de dados': s.semBase.filter((m) => m.projectBoardId === id),
      'Sem prazo': s.semPrazo.filter((m) => m.projectBoardId === id),
      'Inconsistência de vínculo': pm.filter((m) => issueKeys.has(`${m.projectBoardId}:${m.itemId}`)),
    };
  };
  const perProjectInc = s.projs.map((p) => {
    const sets = incSets(p.boardId);
    return { id: p.boardId, name: p.name.length > 28 ? `${p.name.slice(0, 28)}…` : p.name, full: p.name, sets,
      'Sem base de dados': sets['Sem base de dados'].length, 'Sem prazo': sets['Sem prazo'].length, 'Inconsistência de vínculo': sets['Inconsistência de vínculo'].length };
  }).filter((r) => r['Sem base de dados'] + r['Sem prazo'] + r['Inconsistência de vínculo'] > 0);
  const INC_KEYS = ['Sem base de dados', 'Sem prazo', 'Inconsistência de vínculo'] as const;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel className="lg:col-span-2">
        <SectionTitle aside={<span className="text-xs text-muted-foreground">concluídas avaliáveis + atrasadas (contam como não alcançada)</span>}>Medições avaliadas por Status da Meta</SectionTitle>
        {metaByType.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no recorte.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(180, metaByType.length * 40 + 50)}>
            <BarChart data={metaByType} layout="vertical" margin={{ left: 0, right: 24 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(['Alcançada', 'Não alcançada'] as const).map((key, i) => (
                <Bar key={key} dataKey={key} stackId="t" fill={[C(2), C(4)][i]} className="cursor-pointer"
                  onClick={(d: { name?: string }) => {
                    const row = metaByType.find((r) => r.name === d.name);
                    onDrill({ title: `${d.name ?? ''} · Meta ${key.toLowerCase()}`, meds: row?.sets[key] ?? [] });
                  }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel className="lg:col-span-2">
        <SectionTitle aside={
          <span className="flex flex-wrap items-center gap-3">
            {noPrazo > 0 && <span className="text-xs text-muted-foreground">{noPrazo} medição(ões) sem prazo não aparecem</span>}
            <span role="radiogroup" aria-label="Agrupar por" className="relative inline-grid grid-cols-2 rounded-full border border-border bg-muted p-0.5 text-xs font-medium">
              <span aria-hidden className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-200 ${byMonth ? 'translate-x-full' : ''}`} />
              {(['Semana', 'Mês'] as const).map((opt) => {
                const active = (opt === 'Mês') === byMonth;
                return (
                  <button key={opt} role="radio" aria-checked={active} onClick={() => setByMonth(opt === 'Mês')}
                    className={`relative z-10 min-h-8 rounded-full px-4 transition-colors ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{opt}</button>
                );
              })}
            </span>
          </span>
        }>Medições por {byMonth ? 'mês' : 'semana'} (Prazo de Medição)</SectionTitle>
        {weeks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem medições com prazo no recorte.</p> : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(600, weeks.length * 44) }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeks} margin={{ left: -10, right: 12 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} labelFormatter={(l) => (byMonth ? `Mês: ${String(l)}` : `Semana de ${String(l)}`)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(['Concluídas', 'Atrasadas', 'Pendentes'] as const).map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="w" fill={[C(2), C(4), GREY][i]} className="cursor-pointer"
                      onClick={(d: { w?: string; name?: string }) => {
                        const row = weeks.find((r) => r.w === d.w);
                        onDrill({ title: `${key} · ${byMonth ? 'mês' : 'semana de'} ${d.name ?? ''}`, meds: row?.sets[key] ?? [] });
                      }} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Panel>
      <Panel className="lg:col-span-2">
        <SectionTitle aside={<Slide options={['Execução', 'Inconsistências']} value={incView ? 1 : 0} onChange={(v) => setIncView(v === 1)} label="Visão do comparativo" />}>
          {incView ? 'Inconsistências por projeto' : 'Comparativo por projeto'}
        </SectionTitle>
        {incView ? (perProjectInc.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma inconsistência no recorte.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(220, perProjectInc.length * 56)}>
            <BarChart data={perProjectInc} layout="vertical" margin={{ left: 0, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {INC_KEYS.map((key, i) => (
                <Bar key={key} dataKey={key} fill={[C(3), 'hsl(var(--warn))', C(4)][i]} radius={[0, 3, 3, 0]} className="cursor-pointer"
                  onClick={(d: { id?: string; full?: string }) => {
                    const row = perProjectInc.find((r) => r.id === d.id);
                    onDrill({ title: `${key} · ${d.full ?? ''}`, meds: row?.sets[key] ?? [] });
                  }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )) : perProject.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no recorte.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(220, perProject.length * 56)}>
            <BarChart data={perProject} layout="vertical" margin={{ left: 0, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(['Previstas', 'Concluídas', 'Atrasadas'] as const).map((key, i) => (
                <Bar key={key} dataKey={key} fill={[GREY, C(2), C(4)][i]} radius={[0, 3, 3, 0]} className="cursor-pointer"
                  onClick={(d: { id?: string; full?: string }) => {
                    const src = key === 'Previstas' ? s.meds : key === 'Concluídas' ? s.concluded : s.late;
                    onDrill({ title: `${key} · ${d.full ?? ''}`, meds: src.filter((m) => m.projectBoardId === d.id) });
                  }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}
