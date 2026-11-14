import { Checkbox } from '@components/ui/checkbox';
import { Chip, statusTone } from '@generated/components/painel/Chips';
import {
  CustoCell, DecisaoCell, PerspectivaCell, PessoasCell, ProdutosCell, ProjetoCell, TemperaturaCell, TerminoCell,
} from '@generated/components/painel/ProjectCells';
import type { Row } from '@generated/lib/painel';

/** Cards no mobile (mesmo conteúdo da tabela). */
export function MobileList({ rows, onOpen, carregando, sel, onSel }: {
  rows: Row[]; onOpen: (id: string) => void; carregando: boolean; sel?: Set<string>; onSel?: (id: string, v: boolean) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.projeto.id} className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-start gap-3">
            {onSel && <Checkbox className="mt-0.5" checked={!!sel?.has(r.projeto.id)} onCheckedChange={(v) => onSel(r.projeto.id, v === true)} aria-label={`Selecionar ${r.projeto.name}`} />}
            <div className="min-w-0 flex-1"><ProjetoCell r={r} onOpen={() => onOpen(r.projeto.id)} /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone={statusTone(r.projeto.status)}>{r.projeto.status ?? 'Sem status'}</Chip>
            <PerspectivaCell r={r} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div><dt className="mb-1 text-muted-foreground">Último produto previsto</dt><dd><TerminoCell r={r} /></dd></div>
            <div><dt className="mb-1 text-muted-foreground">Equipe</dt><dd><PessoasCell r={r} /></dd></div>
            <div><dt className="mb-1 text-muted-foreground">Custo Total/mês</dt><dd className="[&>div]:items-start"><CustoCell r={r} /></dd></div>
            <div><dt className="mb-1 text-muted-foreground">Produtos restantes</dt><dd className="[&>div]:items-start"><ProdutosCell r={r} carregando={carregando} /></dd></div>
            <div><dt className="mb-1 text-muted-foreground">Decisão</dt><dd><DecisaoCell r={r} /></dd></div>
            {r.temperatura && <div><dt className="mb-1 text-muted-foreground">Temperatura da perspectiva</dt><dd><TemperaturaCell r={r} /></dd></div>}
          </dl>
          <button type="button" onClick={() => onOpen(r.projeto.id)} className="min-h-11 rounded-md border border-border text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Abrir detalhes
          </button>
        </li>
      ))}
    </ul>
  );
}
