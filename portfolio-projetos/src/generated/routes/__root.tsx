import { useEffect } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

function RootComponent() {
  // Segue o tema da monday (claro/escuro/preto).
  useEffect(() => {
    const apply = (t?: string) => document.documentElement.classList.toggle('dark', !!t && t !== 'light');
    const off = monday.listen('context', (r: any) => apply(r?.data?.theme));
    return () => { try { (off as any)?.(); } catch { /* sem cancelamento */ } };
  }, []);
  return <Outlet />;
}
export const Route = createRootRoute({ component: RootComponent });
