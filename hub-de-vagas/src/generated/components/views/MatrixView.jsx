import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { colorFor } from '@generated/lib/colors';
import { canon, normKey, pillVars, PILL_CLS, clean } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

const short = (r) => { const n = String(canon(r) ?? '').match(/\d+/); return n ? `R${n[0]}` : '•'; };

export default function MatrixView({ vagas, onOpenMatch, onOpenPerfil, onOpenVaga, byId }) {
  const [hover, setHover] = useState({ r: null, c: null });
  const { cols, projects, rows } = useMemo(() => {
    const cs = [...vagas].sort((a, b) => (clean(a.projeto) ?? '~').localeCompare(clean(b.projeto) ?? '~', 'pt') || a.name.localeCompare(b.name, 'pt'));
    const proj = [];
    cs.forEach((v) => { const p = clean(v.projeto) ?? 'Sem informação'; const last = proj[proj.length - 1]; if (last?.name === p) last.span += 1; else proj.push({ name: p, span: 1, id: v.id }); });
    const map = new Map();
    cs.forEach((v) => (v._visibleMatches ?? v._matches).forEach((m) => {
      // A match linked to several profiles appears on each person's row.
      const people = m._links?.length ? m._links.map((l) => ({ key: `p:${l.id}`, name: l.name, perfilId: l.id })) : [{ key: `n:${normKey(m._pessoa)}`, name: m._pessoa, perfilId: null }];
      people.forEach((pp) => {
        if (!map.has(pp.key)) map.set(pp.key, { key: pp.key, name: pp.name, perfilId: pp.perfilId, semPerfil: m._semPerfil, cells: {} });
        const row = map.get(pp.key);
        if (!row.cells[v.id]) row.cells[v.id] = m;
      });
    }));
    const rs = [...map.values()].map((r) => ({ ...r, total: Object.keys(r.cells).length })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt'));
    return { cols: cs.map((v) => ({ v, total: rs.filter((r) => r.cells[v.id]).length })), projects: proj, rows: rs };
  }, [vagas]);

  if (!cols.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{rows.length} pessoas × {cols.length} vagas · célula = rodada, cor = status do match</p>
      <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-card" onMouseLeave={() => setHover({ r: null, c: null })}>
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 h-8 min-w-[200px] border-b border-r border-border bg-card px-3 text-left text-[11px] font-normal text-muted-foreground">Projeto</th>
              {projects.map((p) => <th key={p.id} colSpan={p.span} className="sticky top-0 z-20 h-8 max-w-0 truncate border-b border-r border-border bg-muted px-2 text-left font-medium" title={p.name}>{p.name}</th>)}
              <th className="sticky top-0 z-20 h-8 border-b border-border bg-muted px-2"><span className="sr-only">Totais</span></th>
            </tr>
            <tr>
              <th className="sticky left-0 top-8 z-30 border-b border-r border-border bg-card px-3 py-2 text-left font-medium">Pessoa</th>
              {cols.map(({ v, total }, ci) => (
                <th key={v.id} onMouseEnter={() => setHover({ r: null, c: ci })} className={cn('sticky top-8 z-20 w-28 min-w-28 max-w-28 border-b border-r border-border bg-card px-1.5 py-2 text-left align-bottom font-normal', hover.c === ci && 'bg-accent')}>
                  <button onClick={() => onOpenVaga(v.id)} title={`${v.name} · Cód. ${v.id}`} className={cn('line-clamp-3 text-left leading-tight hover:underline', total === 0 && 'text-destructive')}>{v.cargoPapel || v.name}<span className="block text-[10px] font-normal tabular-nums text-muted-foreground">#{v.id}</span></button>
                </th>
              ))}
              <th className="sticky top-8 z-20 border-b border-border bg-card px-3 py-2 text-right font-medium">Vagas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.key}>
                <th onMouseEnter={() => setHover({ r: ri, c: null })} className={cn('sticky left-0 z-10 min-w-[200px] max-w-[240px] border-b border-r border-border bg-card px-3 py-1.5 text-left font-medium', hover.r === ri && 'bg-accent')}>
                  <button onClick={() => (r.perfilId && byId[r.perfilId]?.type === 'perfil' ? onOpenPerfil(r.perfilId) : onOpenMatch(Object.values(r.cells)[0]))} className="flex w-full min-w-0 items-center gap-1.5 text-left hover:underline" title={r.semPerfil ? `${r.name} · sem perfil vinculado` : r.name}>
                    <span className="truncate">{r.name}</span>
                    {r.total >= 3 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" aria-label="Em 3 ou mais vagas" />}
                  </button>
                </th>
                {cols.map(({ v }, ci) => {
                  const m = r.cells[v.id];
                  const color = m ? colorFor('statusDoMatch', m.statusDoMatch) : null;
                  return (
                    <td key={v.id} onMouseEnter={() => setHover({ r: ri, c: ci })} className={cn('h-9 border-b border-r border-border p-1 text-center', (hover.r === ri || hover.c === ci) && 'bg-accent/50')}>
                      {m && (
                        <button onClick={() => onOpenMatch(m)} title={`${canon(m.rodada) ?? 'Sem rodada'} · ${canon(m.statusDoMatch) ?? 'Sem status'}`}
                          className={`inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 font-medium ${PILL_CLS}`} style={pillVars(color)}>
                          {short(m.rodada)}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className={cn('border-b border-border px-3 text-right tabular-nums', r.total >= 3 && 'font-medium text-[hsl(var(--warning))]')}>{r.total}</td>
              </tr>
            ))}
            <tr>
              <th className="sticky bottom-0 left-0 z-20 border-r border-t border-border bg-muted px-3 py-2 text-left font-medium">Pessoas por vaga</th>
              {cols.map(({ v, total }) => <td key={v.id} className={cn('sticky bottom-0 z-10 border-r border-t border-border bg-muted py-2 text-center tabular-nums', total === 0 && 'font-medium text-destructive')}>{total}</td>)}
              <td className="sticky bottom-0 z-10 border-t border-border bg-muted"><span className="sr-only">—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pessoa em match com os filtros atuais.</p>}
    </div>
  );
}
