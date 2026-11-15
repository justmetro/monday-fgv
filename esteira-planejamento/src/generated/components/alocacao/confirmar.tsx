import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@components/ui/alert-dialog';

interface Pedido { titulo: string; texto: string; ok: string }

/** Promise-based confirmation dialog: `const ok = await perguntar({...})`. Render `dialogo` once. */
export function useConfirmar() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const perguntar = useCallback((p: Partial<Pedido> & { texto: string }) => new Promise<boolean>((res) => {
    resolver.current = res;
    setPedido({ titulo: p.titulo ?? 'Confirmar', texto: p.texto, ok: p.ok ?? 'Prosseguir' });
  }), []);

  const fechar = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setPedido(null);
  };

  const dialogo = (
    <AlertDialog open={!!pedido} onOpenChange={(o) => !o && fechar(false)}>
      <AlertDialogContent className="rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{pedido?.titulo}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-[13px]">{pedido?.texto}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => fechar(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => fechar(true)} className="border border-input bg-[hsl(var(--surface-3))] text-foreground hover:bg-[hsl(var(--surface-2))]">
            {pedido?.ok}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { perguntar, dialogo };
}
