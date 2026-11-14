import { useCallback, useState } from 'react';
import { Toaster } from '@components/ui/sonner';
import { CalcTab } from '@generated/components/CalcTab';
import { SendTab } from '@generated/components/SendTab';
import { OrphansTab } from '@generated/components/OrphansTab';
import { RefreshButton } from '@generated/components/RefreshButton';
import { ProjectsPage } from '@generated/components/projects/ProjectsPage';
import { ProjectPage } from '@generated/pages/ProjectPage';
import { useWriteMode } from '@generated/lib/write-mode';
import { useRoute, navigate } from '@/router';
import { cn } from '@lib/utils';

const TABS = [
  { id: 'calc', label: 'Rodar calculadora' },
  { id: 'rev', label: 'Revisão e tratamento' },
  { id: 'send', label: 'Enviar ao planejamento' },
  { id: 'orphans', label: 'Limpar órfãos' },
];

function Revisao() {
  const r = useRoute();
  return r.path.startsWith('/projetos') ? <ProjectPage /> : <ProjectsPage />;
}

export default function App() {
  const [tab, setTab] = useState('calc');
  const [busy, setBusy] = useState(false);
  const onBusyChange = useCallback((v: boolean) => setBusy(v), []);
  const { readOnly } = useWriteMode();

  return (
    <div className="app-ground min-h-dvh text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-[hsl(var(--sidebar))]">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-x-8 px-4 sm:px-6 md:flex-row md:items-center">
          <div className="flex items-center justify-between gap-3 pt-2 md:contents">
            <h1 className="text-[15px] font-semibold text-foreground">Calculadora de Riscos</h1>
            <div className="flex items-center gap-3 md:order-last md:ml-auto">
              {readOnly && <span className="mono-label text-[hsl(var(--warning))]">Modo leitura</span>}
              {tab !== 'rev' && <RefreshButton disabled={busy} />}
            </div>
          </div>
          <nav aria-label="Seções" className="-mb-px flex flex-wrap gap-x-5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  disabled={busy && !active}
                  title={busy && !active ? 'Aguarde o fim da execução em andamento' : undefined}
                  onClick={() => { setTab(t.id); if (t.id === 'rev') navigate('/'); }}
                  className={cn(
                    'inline-flex h-12 items-center border-b-2 text-[13.5px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                    active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className={tab === 'rev' ? '' : 'mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6'}>
        {tab === 'calc' && <CalcTab onBusyChange={onBusyChange} onGoOrphans={() => setTab('orphans')} />}
        {tab === 'rev' && <Revisao />}
        {tab === 'send' && <SendTab onBusyChange={onBusyChange} onGoOrphans={() => setTab('orphans')} />}
        {tab === 'orphans' && <OrphansTab onBusyChange={onBusyChange} />}
      </main>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
