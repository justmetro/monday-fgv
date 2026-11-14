import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { Pill, Tag } from '@generated/components/Pill';
import { fmtDate } from '@generated/lib/data';
import { canon, clean } from '@generated/lib/normalize';
import { REASONS } from '@generated/lib/autoMatch';
import { cn } from '@lib/utils';
import PdfButton from '@generated/components/PdfButton';
import { MatchBadges, MatchTags } from '@generated/components/automatch/MatchBadges';

export function RuleBadges({ s, on }) {
  return (
    <>
      {s.reason && <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">{REASONS[s.reason]}</span>}
      {s.reason && on && <span className="shrink-0 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">fora da regra</span>}
      {!s.reason && s.manual && <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">marcado manualmente</span>}
    </>
  );
}

export function MoreButton({ shown, total, onMore, step = 50 }) {
  if (shown >= total) return null;
  return (
    <button onClick={onMore} className="w-full border-t border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      Mostrar mais {Math.min(step, total - shown)} (exibindo {shown} de {total})
    </button>
  );
}

// One suggestion row. Only re-renders when its own checkbox / data changes.
export const SuggestionRow = memo(function SuggestionRow({ k, s, rank, on, toggle, openPerfil }) {
  const p = s.perfil;
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap', s.reason && !on && 'opacity-55')}>
      {s.reason === 'existente' ? <span className="h-4 w-4 shrink-0" aria-hidden /> : <Checkbox checked={on} onCheckedChange={() => toggle(k)} aria-label={`Incluir ${p.name}`} />}
      <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{typeof rank === 'number' ? `${rank}º` : rank}</span>
      <button onClick={() => openPerfil(p.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium hover:underline">{p.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{[clean(p.papelDeOrigem), canon(p.senioridadeAtual), clean(p.ufDeResidncia)?.join(', '), p.dataDeDisponibilidade && `disp. ${fmtDate(p.dataDeDisponibilidade)}`].filter(Boolean).join(' · ')}</span>
      </button>
      <span className="hidden flex-wrap gap-1 lg:flex">{(clean(p.perfilReasDeAtuao) ?? []).slice(0, 2).map((a) => <Tag key={a}>{canon(a)}</Tag>)}</span>
      <RuleBadges s={s} on={on} />
      <MatchTags s={s} compact />
      <MatchBadges s={s} />
      <PdfButton id={p.id} size="sm" />
    </li>
  );
});

// Collapsed list of area-incompatible perfis (kept visible for rare career transitions).
export function IncompatSection({ r, list, checked, toggle, openPerfil }) {
  const [open, setOpen] = useState(false);
  if (!list?.length) return null;
  return (
    <div className="border-t border-border">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />Incompatíveis ({list.length}) <span className="opacity-70">· área incompatível, fora do ranking</span>
      </button>
      {open && (
        <ul className="divide-y divide-border bg-muted/30" aria-label="Perfis incompatíveis">
          {list.map((s) => { const k = `${r.vaga.id}:${s.perfil.id}`; return (
            <li key={k} className="list-none">
              <ul><SuggestionRow k={k} s={s} rank="–" on={checked.has(k)} toggle={toggle} openPerfil={openPerfil} /></ul>
              <p className="px-4 pb-2 pl-14 text-[11px] text-destructive">{s.compat.motivo}</p>
            </li>
          ); })}
        </ul>
      )}
    </div>
  );
}

export const VagaCard = memo(function VagaCard({ r, checked, toggle, openVaga, openPerfil, emptyText, initialRows = 20 }) {
  const v = r.vaga;
  const [limit, setLimit] = useState(initialRows);
  const rows = r.sugestoes.slice(0, limit);
  return (
    <article className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3">
        <button onClick={() => openVaga(v.id)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium hover:underline" title={v.name}>{v.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            Cód. {v.id} · {clean(v.cargoPapel) ?? 'Sem cargo'} · início {fmtDate(v.dataDeIncioPrevista)} · {canon(v.modalidadeDeAtuaoVaga) ?? 'modalidade —'}{clean(v.ufDeAtuao)?.length ? ` (${clean(v.ufDeAtuao).join(', ')})` : ''}
          </span>
        </button>
        <Pill fieldKey="eixoDeAtuao" label={v.eixoDeAtuao} />
        <Pill fieldKey="senioridadeVaga" label={v.senioridadeVaga} />
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{r.rodadaCheia ? `Rodada 4 completa` : `entra como Rodada ${r.rodada}`}</span>
        {r.rodadaCheia && <p className="basis-full rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">Vaga já na Rodada 4 — avaliar manualmente; novas indicações não serão criadas.</p>}
        {r.semInsumo && <p className="basis-full rounded border border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.1)] px-2 py-1 text-xs text-[hsl(var(--warning))]">Confiança baixa: vaga sem competências preenchidas — competências derivadas do eixo/cargo (peso 0,5). Preencha Essenciais/Desejáveis para um match mais preciso.</p>}
      </header>
      {r.sugestoes.length === 0 && r.incompat?.length ? null : r.sugestoes.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{emptyText ?? 'Nenhum perfil passou nos filtros  nas regras atuais.'}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((s, i) => {
              const k = `${v.id}:${s.perfil.id}`;
              return <SuggestionRow key={k} k={k} s={s} rank={i + 1} on={checked.has(k)} toggle={toggle} openPerfil={openPerfil} />;
            })}
          </ul>
          <MoreButton shown={rows.length} total={r.sugestoes.length} step={initialRows <= 5 ? 10 : 50} onMore={() => setLimit((l) => l + (initialRows <= 5 ? 10 : 50))} />
        </>
      )}
      <IncompatSection r={r} list={r.incompat} checked={checked} toggle={toggle} openPerfil={openPerfil} />
    </article>
  );
});

const ProjectGroup = memo(function ProjectGroup({ proj, rs, checked, toggle, openVaga, openPerfil, emptyText, initialRows }) {
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState(20);
  const n = rs.reduce((s, r) => s + r.sugestoes.filter((x) => checked.has(`${r.vaga.id}:${x.perfil.id}`)).length, 0);
  return (
    <section className="flex flex-col gap-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 truncate text-sm font-medium" title={proj}>{proj}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{rs.length} vaga(s) · {n} marcada(s)</span>
      </button>
      {open && (
        <>
          {rs.slice(0, limit).map((r) => <VagaCard key={r.vaga.id} r={r} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} emptyText={emptyText} initialRows={initialRows} />)}
          {rs.length > limit && <button onClick={() => setLimit((l) => l + 20)} className="rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground">Mostrar mais vagas ({rs.length - limit} restantes)</button>}
        </>
      )}
    </section>
  );
});

// Results grouped by Projeto. Collapsed groups don't render their children.
export default function Suggestions({ results, checked, toggle, openVaga, openPerfil, emptyText, initialRows }) {
  const groups = new Map();
  results.forEach((r) => { const p = clean(r.vaga.projeto) ?? 'Sem projeto'; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(r); });
  const list = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt'));
  return (
    <div className="flex flex-col gap-4">
      {list.map(([proj, rs]) => <ProjectGroup key={proj} proj={proj} rs={rs} checked={checked} toggle={toggle} openVaga={openVaga} openPerfil={openPerfil} emptyText={emptyText} initialRows={initialRows} />)}
    </div>
  );
}
