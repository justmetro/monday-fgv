import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { SuggestionRow, IncompatSection } from '@generated/components/automatch/Suggestions';
import { QUAD_CLS } from '@generated/components/automatch/MatchBadges';
import { QUADS } from '@generated/lib/aderencia';
import { cn } from '@lib/utils';

// Grid order: top row = Quali Média/Alta, bottom = Quali Baixa; left = Quanti Baixo, right = Quanti Médio/Alto.
const GRID = [['potencial', 'indicar'], ['descartar', 'verificar']];

export default function MatrixView({ rows, checked, toggle, openVaga, openPerfil }) {
  const [vagaId, setVagaId] = useState('all');
  const [quad, setQuad] = useState('indicar');
  const [limit, setLimit] = useState(50);
  const scope = vagaId === 'all' ? rows : rows.filter((r) => String(r.vaga.id) === vagaId);
  const counts = useMemo(() => {
    const c = { indicar: 0, verificar: 0, potencial: 0, descartar: 0 };
    scope.forEach((r) => { r.sugestoes.forEach((s) => { c[s.quad] += 1; }); c.descartar += r.incompat?.length ?? 0; });
    return c;
  }, [scope]);
  const groups = scope.map((r) => ({ r, list: r.sugestoes.filter((s) => s.quad === quad) })).filter((g) => g.list.length);
  let budget = limit;
  const total = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Vaga</span>
        <Select value={vagaId} onValueChange={(v) => { setVagaId(v); setLimit(50); }}>
          <SelectTrigger className="h-9 w-[min(100%,420px)] rounded-full" aria-label="Filtrar matriz por vaga"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas filtradas ({rows.length})</SelectItem>
            {rows.map((r) => <SelectItem key={r.vaga.id} value={String(r.vaga.id)}>{r.vaga.name} · Cód. {r.vaga.id}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
        <span />
        <span className="text-center text-[11px] text-muted-foreground">Quanti Baixo</span>
        <span className="text-center text-[11px] text-muted-foreground">Quanti Médio/Alto</span>
        {GRID.map((line, i) => [
          <span key={i === 0 ? "y-alta" : "y-baixa"} className="flex items-center text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">{i === 0 ? 'Quali Média/Alta' : 'Quali Baixa'}</span>,
          ...line.map((q) => (
            <button key={q} onClick={() => { setQuad(q); setLimit(50); }} aria-pressed={quad === q}
              className={cn('flex min-h-[96px] flex-col justify-between rounded-md border p-3 text-left transition-shadow', QUAD_CLS[q], quad === q && 'ring-2 ring-ring shadow-[var(--glow-stack)]')}>
              <span className="text-sm font-medium">{QUADS[q].label}</span>
              <span className="text-3xl font-medium tabular-nums tracking-tight">{counts[q]}</span>
              <span className="text-[11px] opacity-80">{QUADS[q].hint}</span>
            </button>
          )),
        ])}
      </div>
      <div className="rounded-md border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{QUADS[quad].label}: {total} perfil(is)</p>
        {!total ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum perfil neste quadrante.</p> : groups.map(({ r, list }) => {
          if (budget <= 0) return null;
          const vis = list.slice(0, budget); budget -= vis.length;
          return (
            <section key={r.vaga.id} className="border-b border-border last:border-0">
              <button onClick={() => openVaga(r.vaga.id)} className="w-full truncate px-4 pt-2 text-left text-xs font-medium hover:underline" title={r.vaga.name}>{r.vaga.name} · Cód. {r.vaga.id}</button>
              <ul className="divide-y divide-border">
                {vis.map((s, i) => { const k = `${r.vaga.id}:${s.perfil.id}`; return <SuggestionRow key={k} k={k} s={s} rank={i + 1} on={checked.has(k)} toggle={toggle} openPerfil={openPerfil} />; })}
              </ul>
            </section>
          );
        })}
        {scope.filter((r) => r.incompat?.length).map((r) => (
          <div key={`inc${r.vaga.id}`}>
            <p className="truncate px-4 pt-2 text-[11px] text-muted-foreground" title={r.vaga.name}>{r.vaga.name}</p>
            <IncompatSection r={r} list={r.incompat} checked={checked} toggle={toggle} openPerfil={openPerfil} />
          </div>
        ))}
        {total > limit && <button onClick={() => setLimit((l) => l + 50)} className="w-full border-t border-border py-2 text-xs text-muted-foreground hover:text-foreground">Mostrar mais ({total - limit} restantes)</button>}
      </div>
    </div>
  );
}
