import { AlertTriangle } from 'lucide-react';

/** Aviso enquanto os projetos salvos vieram da regra antiga (faltam os "Em encerramento"). */
export function ReimportNotice({ needed }: { needed: boolean }) {
  if (!needed) return null;
  return (
    <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>Reimporte os quadros para atualizar os projetos ativos</span>
    </div>
  );
}
