import { memo, useState } from 'react';
import { Checkbox } from '@components/ui/checkbox';
import { RuleBadges, MoreButton } from '@generated/components/automatch/Suggestions';
import { MatchBadges, MatchTags } from '@generated/components/automatch/MatchBadges';
import { fmtDate } from '@generated/lib/data';
import { canon, clean } from '@generated/lib/normalize';
import { cn } from '@lib/utils';
import PdfButton from '@generated/components/PdfButton';

const VagaRow = memo(function VagaRow({ k, r, s, on, toggle, openVaga }) {
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap', s.reason && !on && 'opacity-55')}>
      {s.reason === 'existente' ? <span className="h-4 w-4 shrink-0" aria-hidden /> : <Checkbox checked={on} onCheckedChange={() => toggle(k)} aria-label={`Incluir em ${r.vaga.name}`} />}
      <button onClick={() => openVaga(r.vaga.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm hover:underline" title={r.vaga.name}>{r.vaga.name}</span>
        <span className="block truncate text-xs text-muted-foreground">Cód. {r.vaga.id} · {clean(r.vaga.projeto) ?? 'Sem projeto'} · Rodada {r.rodada}</span>
      </button>
      <RuleBadges s={s} on={on} />
      <MatchTags s={s} compact />
      <MatchBadges s={s} />
    </li>
  );
});

const PerfilCard = memo(function PerfilCard({ row, checked, toggle, openVaga, openPerfil }) {
  const { perfil: p, items, all } = row;
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(5);
  const list = showAll ? all : items;
  const vis = list.slice(0, limit);
  return (
    <article className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <button onClick={() => openPerfil(p.id)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium hover:underline">{p.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{[clean(p.papelDeOrigem), canon(p.senioridadeAtual), canon(p.vnculo), clean(p.ufDeResidncia)?.join(', '), p.dataDeDisponibilidade && `disp. ${fmtDate(p.dataDeDisponibilidade)}`].filter(Boolean).join(' · ')}</span>
        </button>
        {items.length ? <span className="text-xs text-muted-foreground">{items.length} vaga(s) sugerida(s)</span>
          : <span className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">sem vaga compatível</span>}
        <PdfButton id={p.id} size="sm" />
        {all.length > 0 && (
          <button onClick={() => { setShowAll((s) => !s); setLimit(5); }} aria-pressed={showAll} className={cn('h-7 rounded-full border px-3 text-xs', showAll ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-primary/40')}>
            {showAll ? 'Só sugeridas' : `Mostrar todas as vagas do mês (${all.length})`}
          </button>
        )}
      </header>
      {vis.length > 0 && (
        <>
          <ul className="divide-y divide-border">
            {vis.map(({ r, s }) => { const k = `${r.vaga.id}:${p.id}`; return <VagaRow key={k} k={k} r={r} s={s} on={checked.has(k)} toggle={toggle} openVaga={openVaga} />; })}
          </ul>
          <MoreButton shown={vis.length} total={list.length} step={10} onMore={() => setLimit((l) => l + 10)} />
        </>
      )}
    </article>
  );
});

export default function PerfilView({ rows, checked, toggle, openVaga, openPerfil }) {
  const [limit, setLimit] = useState(50);
  if (!rows.length) return <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhum perfil com os filtros atuais.</p>;
  return (
    <div className="flex flex-col gap-3">
      {rows.slice(0, limit).map((row) => <PerfilCard key={row.perfil.id} row={row} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} />)}
      {rows.length > limit && <button onClick={() => setLimit((l) => l + 50)} className="rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:text-foreground">Mostrar mais {Math.min(50, rows.length - limit)} perfis (exibindo {limit} de {rows.length})</button>}
    </div>
  );
}
