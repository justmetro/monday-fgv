import { Lock } from 'lucide-react';
import { useWriteMode } from '@generated/lib/write-mode';

export function ReadOnlyBanner() {
  const { readOnly, setReadOnly } = useWriteMode();
  if (!readOnly) return null;
  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] p-4 sm:flex-row sm:items-center"
    >
      <Lock className="size-5 shrink-0 text-[hsl(var(--warning))]" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">Modo leitura</p>
        <p className="text-muted-foreground">
          O quadro 09.4 recusou a gravação por falta de permissão de edição. Você pode consultar tudo, mas nenhuma
          alteração será salva. Peça acesso de edição ao responsável pelo quadro.
        </p>
      </div>
      <button type="button" className="ghost-pill self-start sm:self-auto" onClick={() => setReadOnly(false)}>
        Tentar gravar novamente
      </button>
    </div>
  );
}
