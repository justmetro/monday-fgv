import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { refreshAll } from '@generated/lib/projectsStore';
import { useProjectsStore } from '@generated/hooks/useProjects';
import { cn } from '@lib/utils';

const hhmm = (d) => d?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Atualizar dados": recarrega a base de projetos (e a meta do envio, se já carregada) sem esvaziar a tela. */
export function RefreshButton({ disabled }) {
  const store = useProjectsStore();
  const [working, setWorking] = useState(false);
  const spinning = working || store.refreshing || store.status === 'loading';

  const onClick = async () => {
    setWorking(true);
    try {
      await refreshAll();
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
    } finally {
      setWorking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || spinning}
      title={disabled ? 'Aguarde o fim da execução em andamento' : 'Recarregar os projetos do 09.1'}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[5px] px-2.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-[hsl(var(--ink-soft))] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCw className={cn('size-3.5', spinning && 'animate-spin')} aria-hidden />
      <span>Atualizar dados</span>
      {store.loadedAt && <span className="hidden tabular-nums sm:inline">· Atualizado às {hhmm(store.loadedAt)}</span>}
    </button>
  );
}
