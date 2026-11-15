import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@components/ui/alert-dialog';

interface Props {
  open: boolean;
  campos: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSave({ open, campos, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Confirmar alteração no quadro?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">
            Esta edição muda o Status Planejamento, o Gerente (relação) ou valores financeiros, que alimentam prazos, saldos, carga e indicadores.
            Os campos abaixo serão gravados no quadro 02.01:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <li key={c} className="rounded-[var(--radius-sm)] border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-xs text-foreground">{c}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Salvar no quadro</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
