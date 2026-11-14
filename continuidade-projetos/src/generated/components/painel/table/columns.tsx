import type { ReactNode } from 'react';
import { Chip, statusTone } from '@generated/components/painel/Chips';
import {
  CustoCell, DecisaoCell, PerspectivaCell, PessoasCell, ProdutosCell, ProjetoCell, TemperaturaCell, TerminoCell,
} from '@generated/components/painel/ProjectCells';
import type { Row } from '@generated/lib/painel';
import type { SortKey } from '@generated/lib/filtros';

export type ColId = SortKey;
type Ctx = { carregando: boolean; onOpen: (id: string) => void };

export type Coluna = {
  id: ColId; label: string; align?: 'right'; w: string; hideable: boolean;
  cell: (r: Row, ctx: Ctx) => ReactNode;
};

export const COLUNAS: Coluna[] = [
  { id: 'projeto', label: 'Projeto', w: 'w-[24%]', hideable: false, cell: (r, c) => <ProjetoCell r={r} onOpen={() => c.onOpen(r.projeto.id)} /> },
  { id: 'status', label: 'Status', w: 'w-[9%]', hideable: true, cell: (r) => <Chip tone={statusTone(r.projeto.status)}>{r.projeto.status ?? 'Sem status'}</Chip> },
  {
    id: 'gerente', label: 'Gerente atual', w: 'w-[10%]', hideable: true,
    cell: (r) => <span className="line-clamp-2 break-words text-sm text-foreground" title={r.projeto.gerentes.join(', ')}>{r.projeto.gerentes.join(', ') || '—'}</span>,
  },
  { id: 'termino', label: 'Último produto previsto', w: 'w-[9%]', hideable: true, cell: (r) => <TerminoCell r={r} /> },
  { id: 'pessoas', label: 'Equipe', w: 'w-[9%]', hideable: true, cell: (r) => <PessoasCell r={r} /> },
  { id: 'custo', label: 'Custo Total/mês', align: 'right', w: 'w-[10%]', hideable: true, cell: (r) => <CustoCell r={r} /> },
  { id: 'produtos', label: 'Produtos restantes', align: 'right', w: 'w-[8%]', hideable: true, cell: (r, c) => <ProdutosCell r={r} carregando={c.carregando} /> },
  { id: 'perspectiva', label: 'Perspectiva de renovação/aditivo', w: 'w-[8%]', hideable: true, cell: (r) => <PerspectivaCell r={r} /> },
  { id: 'temperatura', label: 'Temperatura da perspectiva', w: 'w-[8%]', hideable: true, cell: (r) => <TemperaturaCell r={r} /> },
  { id: 'decisao', label: 'Decisão', w: 'w-[10%]', hideable: true, cell: (r) => <DecisaoCell r={r} /> },
];

const STORAGE_KEY = 'painel-continuidade:colunas-ocultas';

export function lerOcultas(): ColId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? COLUNAS.filter((c) => c.hideable && arr.includes(c.id)).map((c) => c.id) : [];
  } catch {
    return [];
  }
}
export function gravarOcultas(ids: ColId[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* armazenamento indisponível: ignora */
  }
}
