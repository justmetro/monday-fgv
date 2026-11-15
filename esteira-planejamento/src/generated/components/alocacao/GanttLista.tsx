import { useEffect, useMemo, useState } from 'react';
import { Columns3 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { fmtDate, DASH } from '@generated/lib/format';
import type { Capacidade } from '@generated/lib/alocacao';
import { ORIGEM_CURTA } from '@generated/lib/chegada';
import { NomeLink } from '@generated/components/NomeLink';
import { Chip } from '@generated/components/alocacao/bits';
import { GANTT_CAP_COR } from '@generated/components/alocacao/cores';
import { tabelaCls, theadCls, thCls, trCls } from '@generated/components/alocacao/cards';
import type { LinhaGantt } from '@generated/components/alocacao/ganttDados';

const CAP_LISTA: Record<Capacidade, string> = { 'Curto prazo': 'Curto', 'Médio prazo': 'Médio', 'Longo prazo': 'Longo', Não: 'Não' };

/** Optional columns (hidden by default; the data stays in the Gantt tooltip and in the side panel). */
type ColOpc = 'chegada' | 'meses' | 'origem';
const COLS_OPC: { k: ColOpc; label: string }[] = [
  { k: 'chegada', label: 'Chegada prevista' }, { k: 'meses', label: 'Meses' }, { k: 'origem', label: 'Origem dos meses' },
];
const CHAVE = 'esteira.alocPorGerente.colunas';

function lerPreferencia(): Set<ColOpc> {
  try {
    const raw = window.localStorage.getItem(CHAVE);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? v.filter((x): x is ColOpc => COLS_OPC.some((c) => c.k === x)) : []);
  } catch {
    return new Set();
  }
}

/** Simplified list of the "Alocação por Gerente": one row per project, ordered by end date (ascending). */
export function GanttLista({ linhas, onGerente }: { linhas: LinhaGantt[]; onGerente: (id: string) => void }) {
  const [visiveis, setVisiveis] = useState<Set<ColOpc>>(new Set());
  useEffect(() => { setVisiveis(lerPreferencia()); }, []);
  const alternar = (k: ColOpc, on: boolean) => setVisiveis((s) => {
    const n = new Set(s);
    if (on) n.add(k); else n.delete(k);
    try { window.localStorage.setItem(CHAVE, JSON.stringify([...n])); } catch (e) { console.error('Preferência de colunas não salva', e); }
    return n;
  });
  const ver = (k: ColOpc) => visiveis.has(k);
  const nCols = 5 + visiveis.size;

  const rows = useMemo(() => linhas
    .flatMap((l) => l.barras.map((b) => ({ ...b, gerente: l.g.g.nome, gerenteId: l.g.g.id, cap: l.cap })))
    .sort((a, b) => (a.fim?.getTime() ?? Infinity) - (b.fim?.getTime() ?? Infinity) || a.gerente.localeCompare(b.gerente, 'pt-BR')), [linhas]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-xs text-muted-foreground hover:text-foreground md:h-8">
              <Columns3 className="size-3.5" aria-hidden /> Colunas
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-[var(--radius-lg)] border-border">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Colunas opcionais</DropdownMenuLabel>
            {COLS_OPC.map((c) => (
              <DropdownMenuCheckboxItem key={c.k} checked={ver(c.k)} onSelect={(e) => e.preventDefault()} onCheckedChange={(on) => alternar(c.k, !!on)} className="text-[13px]">
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-card">
        <table className={tabelaCls}>
          <thead className={theadCls}>
            <tr>
              <th scope="col" className={thCls}>Gerente</th>
              <th scope="col" className={thCls}>Projeto</th>
              <th scope="col" className={thCls}>Início</th>
              {ver('chegada') && <th scope="col" className={thCls}>Chegada prevista</th>}
              {ver('meses') && <th scope="col" className={thCls}>Meses</th>}
              {ver('origem') && <th scope="col" className={thCls}>Origem dos meses</th>}
              <th scope="col" className={thCls} aria-sort="ascending">Término / fim previsto ↑</th>
              <th scope="col" className={thCls}>Capacidade</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={nCols} className="px-3 py-6 text-center text-[13px] text-muted-foreground">Nenhum projeto ativo ou projetado para os gerentes filtrados.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.gerenteId}-${r.key}`} className={trCls} title={r.titulo}>
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" onClick={() => onGerente(r.gerenteId)} className="rounded-[var(--radius-sm)] text-left text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {r.gerente}
                  </button>
                </td>
                <td className="max-w-[360px] px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <NomeLink p={r.p} />
                    {r.pendente && <Chip corVar="--temp-45">Pendente</Chip>}
                  </span>
                </td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {!r.pendente ? fmtDate(r.ini) : r.inicioAssinatura ? <span title="Início pela data de assinatura">{fmtDate(r.ini)}</span> : DASH}
                </td>
                {ver('chegada') && (
                  <td className="tnum whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {!r.chegada ? DASH : r.chegada.inicio ? fmtDate(r.chegada.inicio) : <span className="text-[hsl(var(--warning))]">Sem previsão</span>}
                  </td>
                )}
                {ver('meses') && <td className="tnum px-3 py-2 text-muted-foreground">{r.chegada ? r.chegada.meses : DASH}</td>}
                {ver('origem') && <td className="px-3 py-2 text-xs text-muted-foreground" title={r.chegada?.rotuloOrigem}>{r.chegada ? ORIGEM_CURTA[r.chegada.origem] : DASH}</td>}
                <td className="tnum whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(r.fim)}{r.pendente ? ' (prev.)' : ''}</td>
                <td className="px-3 py-2"><Chip corVar={GANTT_CAP_COR[r.cap]}>{CAP_LISTA[r.cap]}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
