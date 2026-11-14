import { useState } from 'react';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { splitList } from '@generated/lib/ops';
import { fmtPct } from '@generated/lib/format';
import type { ScheduleItemDoc } from '@generated/models';
import { BarCard, countBy, KpiRow } from './ChartCard';
import { StackedPctCard, type Bucket } from './StackedPctCard';

const nrm = (s: string | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const GREEN = 'hsl(var(--ok))';
const YELLOW = 'hsl(var(--warn))';
const RED = 'hsl(var(--destructive))';
const GREY = 'hsl(var(--muted-foreground) / 0.4)';
const STATUS_B: Bucket[] = [
  { key: 'done', label: 'Concluído', color: GREEN }, { key: 'prog', label: 'Em progresso', color: YELLOW },
  { key: 'idle', label: 'Não iniciado / Despriorizado', color: GREY }, { key: 'stop', label: 'Parado / Cancelado', color: RED },
];
const HEALTH_B: Bucket[] = [
  { key: 'ok', label: 'No prazo', color: GREEN }, { key: 'warn', label: 'Atenção', color: YELLOW },
  { key: 'lateDone', label: 'Concluído com atraso', color: 'hsl(var(--destructive) / 0.4)' },
  { key: 'late', label: 'Atrasado não concluído', color: 'hsl(0 72% 36%)' }, { key: 'none', label: 'Sem saúde / Despriorizado', color: GREY },
];
import type { OpsDrill } from './OpsDrillSheet';
import { Panel, SectionTitle } from '../ui-bits';

/** Aba Cronograma do Painel gerencial. */
export function ScheduleTab({ m, s, onDrill }: { m: OpsModel; s: OpsScope; onDrill: (d: OpsDrill) => void }) {
  const [onlyMonth, setOnlyMonth] = useState(false);
  const ym = m.today.slice(0, 7);
  // Atividade do mês: período planejado (início–fim) cruza o mês atual.
  const inMonth = (x: ScheduleItemDoc) => { const a = (x.inicioPlanejado ?? x.fimPlanejado)?.slice(0, 7); const b = (x.fimPlanejado ?? x.inicioPlanejado)?.slice(0, 7); return !!a && !!b && a <= ym && ym <= b; };
  const all = onlyMonth ? s.schedule.filter(inMonth) : s.schedule;
  const toggle = (
    <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
      <input type="checkbox" checked={onlyMonth} onChange={(e) => setOnlyMonth(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
      Somente atividades do mês atual
    </label>
  );
  const valid = all.filter((x) => !m.isExcluded(x));
  const done = valid.filter(m.isDone);
  const late = valid.filter((x) => x.flagAtrasada);
  const noResp = valid.filter((x) => x.flagSemResponsavel);
  const keys = new Set(all.map((x) => `${x.projectBoardId}:${x.itemId}`));
  const pend = m.issues.filter((i) => i.entity === 'atividade' && keys.has(`${i.projectBoardId}:${i.itemId}`));
  const pendItems = all.filter((x) => pend.some((p) => p.projectBoardId === x.projectBoardId && p.itemId === x.itemId));
  const subs = s.subitems.filter((x) => keys.has(`${x.projectBoardId}:${x.parentItemId}`));
  const pName = (x: ScheduleItemDoc) => m.projectBy.get(x.projectBoardId)?.name ?? x.projectBoardId;
  const statusBucket = (x: ScheduleItemDoc) => {
    const s = nrm(x.status);
    if (m.isDone(x) || /conclu|finaliz|feito|done/.test(s)) return 'done';
    if (/cancel|parad/.test(s)) return 'stop';
    if (/progress|andamento|execu|fazendo/.test(s)) return 'prog';
    return 'idle';
  };
  const healthBucket = (x: ScheduleItemDoc) => {
    const s = nrm(x.saude);
    if (/despriori/.test(nrm(x.status)) || /despriori/.test(s) || !s) return 'none';
    const h = m.health(x);
    if (h === 'bad' || /atras/.test(s)) return statusBucket(x) === 'done' ? 'lateDone' : 'late';
    if (h === 'ok' || /no prazo|em dia/.test(s)) return 'ok';
    if (h === 'warn') return 'warn';
    return 'none';
  };
  const byProject = countBy(late, (x) => m.projectBy.get(x.projectBoardId)?.name ?? x.projectBoardId);

  if (all.length === 0) return <div className="space-y-5">{toggle}<Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade de cronograma no recorte. Configure o grupo Cronograma dos projetos na tela de Importação.</p></Panel></div>;
  return (
    <div className="space-y-5">
      {toggle}
      <KpiRow items={[
        { label: 'Atividades', value: String(valid.length), hint: `${subs.length} subatividades`, onClick: () => onDrill({ title: 'Atividades', schedule: valid }) },
        { label: 'Concluídas', value: String(done.length), tone: 'ok', onClick: () => onDrill({ title: 'Atividades concluídas', schedule: done }) },
        { label: 'Atrasadas', value: String(late.length), tone: late.length ? 'bad' : undefined, hint: 'fim planejado vencido', onClick: () => onDrill({ title: 'Atividades atrasadas', schedule: late }) },
        { label: '% de conclusão', value: valid.length ? fmtPct((done.length / valid.length) * 100) : '—', hint: 'excluídas fora da conta' },
        { label: 'Sem responsável', value: String(noResp.length), tone: noResp.length ? 'warn' : undefined, onClick: () => onDrill({ title: 'Atividades sem responsável', schedule: noResp }) },
        { label: 'Sem produto vinculado', value: String(pendItems.length), tone: pendItems.length ? 'warn' : undefined, hint: 'pendência de vínculo', onClick: () => onDrill({ title: 'Atividades com pendência de produto', schedule: pendItems }) },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <StackedPctCard title="Status por projeto (100%)" buckets={STATUS_B} list={all} groupOf={pName} bucketOf={statusBucket}
          onPick={(g, b, items) => onDrill({ title: `${g} · ${b.label}`, schedule: items })} />
        <StackedPctCard title="Saúde por projeto (100%)" buckets={HEALTH_B} list={all} groupOf={pName} bucketOf={healthBucket}
          onPick={(g, b, items) => onDrill({ title: `${g} · ${b.label}`, schedule: items })} />
        <BarCard title="Por frente" data={countBy(all, (x) => splitList(x.frentes))} onPick={(d) => onDrill({ title: `Frente: ${d.name}`, schedule: d.items })} />
        <BarCard title="Atrasos por projeto" data={byProject} onPick={(d) => onDrill({ title: `Atrasadas: ${d.name}`, schedule: d.items })} />
      </div>
      {pend.length > 0 && (
        <Panel>
          <SectionTitle>Pendências de vínculo com produto · {pend.length}</SectionTitle>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
            {pend.slice(0, 200).map((p) => <li key={`${p.projectBoardId}:${p.itemId}:${p.detail}`} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{m.projectBy.get(p.projectBoardId)?.name} · {p.detail}</span></li>)}
          </ul>
        </Panel>
      )}
    </div>
  );
}
