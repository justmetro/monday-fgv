import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@components/ui/dialog';

const ROWS = [
  [['Ctrl', 'K'], 'Busca global'],
  [['G', 'H'], 'Ir para Ação hoje'],
  [['G', 'V'], 'Ir para Vagas & Matches'],
  [['G', 'P'], 'Ir para Perfis para Realocação'],
  [['G', 'O'], 'Ir para Visão Geral'],
  [['Esc'], 'Fechar painel / voltar da ficha'],
  [['?'], 'Mostrar esta ajuda'],
];

export default function ShortcutsHelp({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium tracking-tight">Atalhos de teclado</DialogTitle>
          <DialogDescription>Pressione G e, em seguida, a letra da tela.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {ROWS.map(([keys, label]) => (
            <li key={label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{label}</span>
              <span className="flex items-center gap-1">
                {keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-muted-foreground">{keys[0] === 'Ctrl' ? '+' : 'então'}</span>}
                    <kbd className="min-w-7 rounded border border-border bg-muted px-1.5 py-0.5 text-center text-xs font-medium">{k}</kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
