import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import type { Projeto } from '@generated/lib/format';
import { NomeLink } from '@generated/components/NomeLink';
import { AbrirFechando } from '@generated/components/AbrirProjeto';

const vazio = (v: string[] | null | undefined) => !(v ?? []).some((x) => x?.trim());

/**
 * Discreet badge with the count of projects missing Eixo and/or UF. Clicking a project closes this dialog
 * first and then opens the project panel ("Abrir no quadro ↗" lives inside the panel).
 */
export function SemEixoUf({ items }: { items: Projeto[] }) {
  const [open, setOpen] = useState(false);
  const fechar = useCallback(() => setOpen(false), []);
  const faltando = useMemo(
    () => items
      .map((p) => ({ p, falta: [vazio(p.eixo) && 'Eixo', vazio(p.uf) && 'UF'].filter((x): x is string => !!x) }))
      .filter((x) => x.falta.length > 0)
      .sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR')),
    [items],
  );
  if (!faltando.length) return null;
  const semEixo = faltando.filter((x) => x.falta.includes('Eixo')).length;
  const semUf = faltando.filter((x) => x.falta.includes('UF')).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] px-2.5 text-[11px] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.18)] md:h-6">
          <AlertTriangle className="size-3" aria-hidden />
          {faltando.length} sem Eixo/UF
          <span className="text-[hsl(var(--warning)/0.75)]">({semEixo} sem Eixo · {semUf} sem UF)</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden rounded-[var(--radius-lg)] p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Projetos sem Eixo e/ou UF</DialogTitle>
          <DialogDescription>Ficam fora dos gráficos por eixo e por UF. Clique no projeto para ver detalhes e corrigir.</DialogDescription>
        </DialogHeader>
        <AbrirFechando fechar={fechar}>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {faltando.map(({ p, falta }) => (
              <li key={p.id} className="flex min-h-11 min-w-0 items-center gap-2 px-5 py-2.5">
                <span className="min-w-0 flex-1"><NomeLink p={p} className="text-sm font-normal" /></span>
                {falta.map((f) => (
                  <span key={f} className="shrink-0 rounded-full border border-[hsl(var(--warning)/0.4)] px-2 text-[11px] text-[hsl(var(--warning))]">sem {f}</span>
                ))}
              </li>
            ))}
          </ul>
        </AbrirFechando>
      </DialogContent>
    </Dialog>
  );
}
