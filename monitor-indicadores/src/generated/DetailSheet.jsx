import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@components/ui/sheet';
import { cn } from '@lib/utils';
import ProjectList from '@generated/ProjectList';
import MeasureEditor from '@generated/MeasureEditor';
import { BG, Parcial } from '@generated/bits';
import { consolidate, projectsOf, hasProjects } from '@generated/calc';
import { VALID } from '@generated/useIndicadores';
import { fmtPct, diffPP, unidade } from '@generated/lib';
import { fracLine } from '@generated/tip';
import FonteDado from '@generated/FonteDado';

export default function DetailSheet({ detail, onClose, ind, raw, projects, year, onSaved }) {
  const i = detail && ind.find((x) => x.code === detail.code);
  return (
    <Sheet open={!!i} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {i && <Body i={i} detail={detail} raw={raw} projects={projects} year={year} onSaved={onSaved} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ i, detail, raw, projects, year, onSaved }) {
  const r = consolidate(i, year, detail.months);
  const single = detail.months.length === 1;
  const prio = (st) => (VALID.includes(st) ? 0 : st === 'Não Iniciado' ? 1 : st === 'Cancelado' ? 3 : 2);
  const med = single && raw.filter((m) => m.code === i.code && m.period?.year === year && m.period?.month === detail.months[0])
    .sort((a, b) => prio(a.status) - prio(b.status))[0];
  const s = r?.state ?? 'na';
  const parcial = s === 'parcial';
  const f = fracLine(r, unidade(i));
  return (
    <div className="space-y-5 p-1">
      <SheetHeader className="p-0">
        <SheetDescription className="text-xs font-semibold uppercase tracking-wider">{i.code} · {detail.label}</SheetDescription>
        <SheetTitle className="text-lg leading-snug">{i.curto}</SheetTitle>
      </SheetHeader>
      <div className={cn('grid grid-cols-3 gap-2 rounded-xl p-4', BG[s])}>
        <div><p className="text-xs opacity-80">Resultado</p>
          <p className="text-3xl font-bold tabular-nums">{s === 'na' ? 'N/A' : s === 'nocase' ? '—' : fmtPct(r.apurado)}</p>
          {parcial && <Parcial className="ml-0" />}</div>
        <div><p className="text-xs opacity-80">Meta</p><p className="text-3xl font-semibold tabular-nums text-[hsl(var(--goal))]">{fmtPct(r?.meta ?? i.metaInd)}</p></div>
        <div><p className="text-xs opacity-80">Diferença</p><p className="text-2xl font-bold tabular-nums">{!parcial && r?.apurado != null && r?.meta != null ? diffPP(r.apurado, r.meta) : '—'}</p></div>
        {r && s !== 'na' && (
          <p className="col-span-3 text-sm font-medium">
            {s === 'nocase' ? 'Sem casos (Total Período vazio ou 0)' : `${f}${i.saldo ? '' : ' (Atingido / Total Período)'}`}
          </p>
        )}
        {parcial && <p className="col-span-3 text-xs font-medium">Mês em andamento, resultado provisório.</p>}
        {!single && <p className="col-span-3 text-xs opacity-80">Soma de Atingido ÷ soma de Total Período dos meses fechados.</p>}
      </div>
      <FonteDado i={i} med={med || null} single={single} />
      {hasProjects(i.code) && (
        <section className="space-y-2">
          <div>
            <h3 className="text-sm font-bold">Projetos do 02.01 no período</h3>
            <p className="text-xs text-muted-foreground">Só para consulta: não entram em nenhum número do painel.</p>
          </div>
          <ProjectList rows={projectsOf(projects, year, detail.months)} />
        </section>
      )}
      {single ? (med ? <MeasureEditor med={med} saldo={!!i.saldo} onSaved={onSaved} />
        : <p className="text-sm text-[hsl(var(--goal))]">Não há item de medição para este mês no quadro 01.02.</p>)
        : <p className="text-xs text-[hsl(var(--goal))]">Para editar, abra um mês específico na visão mensal.</p>}
    </div>
  );
}
