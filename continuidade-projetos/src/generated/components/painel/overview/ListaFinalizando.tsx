import { Fragment, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';
import { EquipeChips } from '@generated/components/painel/EquipeChips';
import { fmtBRL, fmtDate, type Row } from '@generated/lib/painel';
import { MODALIDADES, SEM_MODALIDADE } from '@generated/lib/negocio';
import { nomePessoa } from '@generated/lib/equipe';
import { EquipeBaseEditor } from '@generated/components/painel/overview/EquipeBaseEditor';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

function dias(n: number | null) {
  if (n === null) return '—';
  if (n === 0) return 'hoje';
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

/** Lista de projetos finalizando: linha expande com os nomes; clique no nome abre o detalhe. */
export function ListaFinalizando({ rows, titulo, onOpen, onSalvar }: { rows: Row[]; titulo: string; onOpen: (id: string) => void; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras> }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbertos((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <section className="soft-stack min-w-0 rounded-xl bg-card" aria-labelledby="fin-titulo">
      <div className="border-b border-border px-5 py-4">
        <h3 id="fin-titulo" className="text-base font-semibold tracking-[-0.01em] text-foreground">Projetos próximos de finalizar</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{titulo} · {rows.length} projeto(s)</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum projeto finaliza neste período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Expandir</span></th>
                {['Projeto', 'Último produto', 'Vigência contratual', 'Dias restantes', 'Equipe', 'Equipe Base'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">Custo Total/mês</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Custo Base/mês</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = r.projeto.id;
                const aberto = abertos.has(id);
                const vig = r.projeto.contratual;
                return (
                  <Fragment key={id}>
                    <tr className="border-t border-border align-top hover:bg-[hsl(var(--chrome))]">
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => alternar(id)} aria-expanded={aberto} aria-label={aberto ? 'Recolher equipe' : 'Ver nomes da equipe'} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      </td>
                      <td className="max-w-[320px] px-3 py-2">
                        <button type="button" onClick={() => onOpen(id)} className="line-clamp-2 break-words text-left text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {r.projeto.name}
                        </button>
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2">{fmtDate(r.dataFim)}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-muted-foreground">{vig ? `${fmtDate(vig.from)} – ${fmtDate(vig.to)}` : '—'}</td>
                      <td className={cn('tnum whitespace-nowrap px-3 py-2', r.diasFim !== null && r.diasFim <= 30 ? 'font-medium text-[hsl(var(--danger-ink))]' : 'text-foreground')}>{dias(r.diasFim)}</td>
                      <td className="px-3 py-2">
                        {r.semAlocacao && !r.equipe?.nClt ? <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--warning-ink))]"><AlertTriangle className="size-3.5" aria-hidden />Sem equipe cadastrada</span> : <EquipeChips cont={r.equipe?.porModalidade} semModalidade={r.equipe?.semModalidade.length ?? 0} />}
                      </td>
                      <td className="px-3 py-2"><EquipeBaseEditor r={r} onSalvar={onSalvar} /></td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right">{fmtBRL(r.custoMensal)}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{fmtBRL(r.base.custoMensal)}</td>
                    </tr>
                    {aberto && (
                      <tr className="bg-[hsl(var(--chrome))]">
                        <td colSpan={9} className="px-3 pb-3 pt-1 pl-12">
                          <Nomes r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Nomes({ r }: { r: Row }) {
  const todas = r.equipe?.todas ?? [];
  if (!todas.length) return <p className="text-xs text-muted-foreground">Nenhuma pessoa no quadro Equipes Revisadas.</p>;
  const grupos: [string, typeof todas][] = [
    ...MODALIDADES.map((m) => [m, todas.filter((x) => x.modalidade === m)] as [string, typeof todas]),
    [SEM_MODALIDADE, todas.filter((x) => x.modalidade === null)],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {grupos.filter(([, l]) => l.length).map(([g, l]) => (
        <div key={g} className="min-w-0">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{g} · {l.length}</p>
          <ul className="flex flex-col gap-0.5 text-xs">
            {l.map((x) => <li key={x.id} className={cn('break-words', x.nome ? 'text-foreground' : 'italic text-muted-foreground')}>{nomePessoa(x)}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
