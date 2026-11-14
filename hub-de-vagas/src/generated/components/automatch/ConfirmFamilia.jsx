import { useState } from 'react';
import { Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { confirmFamilia, requestReload } from '@generated/lib/familiaWrite';
import { familiaLabels, FAMILIA_COL } from '@generated/lib/compatibilidadeArea';

// "Confirmar família": writes the inferred families into the explicit column after a confirmation dialog.
export default function ConfirmFamilia({ itemId, name, fams, kind }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const labels = familiaLabels(fams);
  if (!labels.length) return null;
  const run = async () => {
    setBusy(true);
    try { const l = await confirmFamilia(itemId, fams); toast.success(`Família de área gravada em ${name}`); setOpen(false); requestReload([{ id: itemId, labels: l }]); } catch (e) { console.error('[familia]', e); toast.error(`Não foi possível gravar a família de área: ${e?.message ?? e}`); } finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="inline-flex h-6 items-center gap-1 rounded-full border border-primary/50 px-2 text-[11px] hover:border-primary">
        <CheckCheck className="h-3 w-3" />Confirmar família
      </button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar família de área</AlertDialogTitle>
            <AlertDialogDescription>
              Gravar <strong>{labels.join(', ')}</strong> na coluna “{FAMILIA_COL.title}” {kind === 'vaga' ? 'da vaga' : 'do perfil'} <strong>{name}</strong>? A partir daí a trava usará só essa coluna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); run(); }} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Gravar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
