import { useEffect } from 'react';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { BarChart3, Database, LayoutGrid, ListTree, Table2 } from 'lucide-react';
import { TooltipProvider } from '@components/ui/tooltip';
import { Toaster } from '@components/ui/sonner';

export const Route = createFileRoute('/_app')({ component: AppLayout });

const APP_NAME = 'Painel de Projetos DGPE';
const NAV = [
  { to: '/', label: 'Painel gerencial', icon: BarChart3 },
  { to: '/panorama', label: 'Panorama dos projetos', icon: LayoutGrid },
  { to: '/dados', label: 'Dados tabulados', icon: Table2 },
  { to: '/indicadores', label: 'Indicadores e medições', icon: ListTree },
  { to: '/importacao', label: 'Importação e atualização', icon: Database },
] as const;

function AppLayout() {
  useEffect(() => { document.title = APP_NAME; }, []);
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{APP_NAME}</span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">FGV DGPE · Superintendência de Projetos</span>
            </div>
            <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: true, includeSearch: false }}
                  className="flex min-h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:border-primary [&.active]:font-medium [&.active]:text-foreground"
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
