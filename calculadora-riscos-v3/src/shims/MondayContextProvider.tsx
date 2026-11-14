import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import mondaySdk from 'monday-sdk-js';

const sdkInit: any = (mondaySdk as any).default ?? mondaySdk;
const monday: any = sdkInit();
monday.setApiVersion?.("2026-10");
export const mondayClient = monday as unknown as { api: (q: string, o?: { variables?: unknown; apiVersion?: string }) => Promise<any> };
type Ctx = { context: Record<string, unknown> | null; isLoading: boolean };
const C = createContext<Ctx>({ context: null, isLoading: true });

export function MondayContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ context: null, isLoading: true });
  useEffect(() => {
    const off = monday.listen('context', (res: { data: Record<string, unknown> }) => setState({ context: res.data, isLoading: false }));
    monday.get('context').then((res: { data: Record<string, unknown> }) => setState({ context: res.data, isLoading: false })).catch(() => {});
    return () => { if (typeof off === 'function') off(); };
  }, []);
  return <C.Provider value={state}>{children}</C.Provider>;
}

export function useMondayContext() {
  return useContext(C);
}
