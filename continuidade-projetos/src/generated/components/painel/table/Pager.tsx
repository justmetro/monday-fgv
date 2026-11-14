import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';

export function Pager({ total, page, pageSize, setPage, setPageSize }: {
  total: number; page: number; pageSize: number; setPage: (n: number) => void; setPageSize: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = 'inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm sm:px-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Linhas por página</span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-9 w-[76px] bg-card" aria-label="Linhas por página"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="tnum text-muted-foreground">{from}–{to} de {total}</span>
        <button type="button" className={btn} onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => setPage(page + 1)} disabled={page >= pages - 1} aria-label="Próxima página">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
