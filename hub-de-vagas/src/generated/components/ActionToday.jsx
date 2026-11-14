import { useMemo, useState } from 'react';
import { ChevronRight, CheckCircle2, AlertTriangle, Hourglass, CalendarClock, UserMinus, UserX, CalendarRange } from 'lucide-react';
import { Pill, PessoaName } from '@generated/components/Pill';
import { RoundAge, InterviewAge, VagaAge, AgeBadge, perfilAge } from '@generated/components/Age';
import { fmtDate, toDate } from '@generated/lib/data';
import { normKey, clean } from '@generated/lib/normalize';
import { todayUTC, daysSince, daysUntil, isOne } from '@generated/lib/dates';
import { desalocInfo, SITU } from '@generated/lib/esteira';
import { cn } from '@lib/utils';

const WAITING = new Set(['aguardando confirmacao', 'aguardando confirmacao do(a) profissional']);

function Section({ icon: Icon, title, hint, rows: all, tone }) {
  const rows = all.filter((r) => !r.header);
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <Icon className={cn('h-4 w-4 shrink-0', rows.length ? (tone === 'danger' ? 'text-destructive' : 'text-[hsl(var(--warning))]') : 'text-primary')} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="block truncate text-xs text-muted-foreground">{hint}</span></span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', rows.length ? 'bg-muted text-foreground' : 'bg-accent text-accent-foreground')}>{rows.length}</span>
      </button>
      {open && (rows.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-border px-4 py-4 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Nada pendente aqui.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {all.map((r) => (r.header ? (
            <li key={r.key} className="flex items-center justify-between bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground"><span>{r.title}</span><span className="tabular-nums">{r.count}</span></li>
          ) : (
            <li key={r.key}>
              <button onClick={r.onClick} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left hover:bg-accent/30 sm:flex-nowrap">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={typeof r.title === 'string' ? r.title : undefined}>{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground" title={r.sub}>{r.sub}</span>
                </span>
                {r.pill}
                {typeof r.badge === 'string'
                  ? <span className={cn('shrink-0 text-xs font-medium tabular-nums', r.tone === 'danger' ? 'text-destructive' : r.tone === 'warn' ? 'text-[hsl(var(--warning))]' : 'text-primary')}>{r.badge}</span>
                  : <span className="shrink-0">{r.badge}</span>}
              </button>
            </li>
          )))}
        </ul>
      ))}
    </section>
  );
}

export default function ActionToday({ data, openVaga, openPerfil, openMatch }) {
  const today = todayUTC();
  const s = useMemo(() => {
    const open = data.vagas.filter((v) => isOne(v.vagaEmAberto));
    const atrasadas = open.filter((v) => { const d = toDate(v.dataDeIncioPrevista); return d && d.getTime() < today; })
      .map((v) => ({ v, n: daysSince(v.dataDeIncioPrevista) })).sort((a, b) => b.n - a.n);
    const parados = data.matches.filter((m) => {
      const waiting = normKey(m.resultadoDaRodada).includes('aguardando') || WAITING.has(normKey(m.statusDoMatch));
      const n = daysSince(m.dataDeEnvioDoCard);
      return waiting && n != null && n > 7;
    }).sort((a, b) => daysSince(b.dataDeEnvioDoCard) - daysSince(a.dataDeEnvioDoCard));
    const entrevistas = data.matches.filter((m) => { const n = daysUntil(m.dataDaEntrevista); return n != null && n >= 0 && n <= 7; })
      .sort((a, b) => daysUntil(a.dataDaEntrevista) - daysUntil(b.dataDaEntrevista));
    const byDisp = (a, b) => desalocInfo(a).date - desalocInfo(b).date;
    const desaloc = data.perfis.filter((p) => desalocInfo(p)?.situ === SITU.ocioso).sort(byDisp);
    const windows = [SITU.ate15, SITU.ate30, SITU.ate60].map((w) => ({ w, list: data.perfis.filter((p) => desalocInfo(p)?.situ === w).sort(byDisp) }));
    const semMatch = open.filter((v) => !v._matches.length);
    return { atrasadas, parados, entrevistas, desaloc, windows, semMatch };
  }, [data, today]);

  const onMatch = (m) => (m._perfilId && data.byId[m._perfilId]?.type === 'perfil' ? openPerfil(m._perfilId) : openMatch(m));
  const total = s.atrasadas.length + s.parados.length + s.entrevistas.length + s.desaloc.length + s.semMatch.length;

  return (
    <div className="flex flex-col gap-4">
      <section className="lattice rounded-md border border-border bg-card px-5 py-5">
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        <p className="mt-1 text-xl font-medium tracking-tight">{total ? <>{total} pontos pedem atenção hoje</> : 'Tudo em dia por aqui.'}</p>
      </section>
      <Section icon={AlertTriangle} tone="danger" title="Vagas atrasadas" hint="Em aberto com início previsto já vencido"
        rows={s.atrasadas.map(({ v, n }) => ({ key: v.id, title: v.name, sub: `Cód. ${v.id} · ${clean(v.projeto) ?? 'Sem projeto'} · início previsto ${fmtDate(v.dataDeIncioPrevista)}`, pill: <Pill fieldKey="statusDaVaga" label={v.statusDaVaga} className="hidden sm:inline-flex" />, badge: <VagaAge vaga={v} />, tone: 'danger', onClick: () => openVaga(v.id) }))} />
      <Section icon={Hourglass} title="Matches parados" hint="Aguardando retorno há mais de 7 dias desde o envio do card"
        rows={s.parados.map((m) => ({ key: m.id, title: <PessoaName match={m} />, sub: m._vagaName, pill: <Pill fieldKey="statusDoMatch" label={m.statusDoMatch} className="hidden sm:inline-flex" />, badge: <RoundAge match={m} />, tone: 'warn', onClick: () => onMatch(m) }))} />
      <Section icon={CalendarClock} title="Entrevistas nos próximos 7 dias" hint="Data da entrevista entre hoje e daqui a uma semana"
        rows={s.entrevistas.map((m) => { const n = daysUntil(m.dataDaEntrevista); return { key: m.id, title: <PessoaName match={m} />, sub: m._vagaName, pill: <Pill fieldKey="rodada" label={m.rodada} className="hidden sm:inline-flex" />, badge: <span className="flex items-center gap-2 text-xs text-muted-foreground">{fmtDate(m.dataDaEntrevista)}<InterviewAge match={m} /></span>, onClick: () => onMatch(m) }; })} />
      <Section icon={UserMinus} tone="danger" title="Pessoas ociosas" hint="Data de disponibilidade + 15 dias de tolerância já vencida · mais antigas primeiro"
        rows={s.desaloc.map((p) => ({ key: p.id, title: p.name, sub: [clean(p.papelDeOrigem), `disponível desde ${fmtDate(p.dataDeDisponibilidade)}`].filter(Boolean).join(' · '), pill: <Pill fieldKey="statusDoPerfil" label={p.statusDoPerfil} className="hidden sm:inline-flex" />, badge: perfilAge(p) ? <AgeBadge {...perfilAge(p)} /> : '', tone: 'danger', onClick: () => openPerfil(p.id) }))} />
      <Section icon={CalendarRange} title="Pessoas a desalocar (próximos 60 dias)" hint="Por data de disponibilidade · até 15 dias, até 1 mês, até 2 meses"
        rows={s.windows.flatMap(({ w, list }) => (list.length ? [{ key: `h-${w}`, header: true, title: w.replace('A desalocar — ', ''), count: list.length },
          ...list.map((p) => ({ key: p.id, title: p.name, sub: [clean(p.papelDeOrigem), `disponível em ${fmtDate(p.dataDeDisponibilidade)}`].filter(Boolean).join(' · '), pill: <Pill fieldKey="statusDoPerfil" label={p.statusDoPerfil} className="hidden sm:inline-flex" />, badge: perfilAge(p) ? <AgeBadge {...perfilAge(p)} /> : '', onClick: () => openPerfil(p.id) }))] : []))} />
      <Section icon={UserX} title="Vagas em aberto sem nenhum match" hint="Nenhuma pessoa indicada ainda"
        rows={s.semMatch.map((v) => ({ key: v.id, title: v.name, sub: `Cód. ${v.id} · ${clean(v.projeto) ?? 'Sem projeto'}`, pill: <Pill fieldKey="prioridadeDaVaga" label={v.prioridadeDaVaga} className="hidden sm:inline-flex" />, badge: 'sem matches', tone: 'warn', onClick: () => openVaga(v.id) }))} />
    </div>
  );
}
