import { createContext, useCallback, useContext, type ReactNode } from 'react';
import type { Projeto } from '@generated/lib/format';

/** Opens the project side panel (ProjectSheet) from anywhere in the app, without leaving the screen. */
export const AbrirProjetoCtx = createContext<((p: Projeto) => void) | null>(null);
export const useAbrirProjeto = () => useContext(AbrirProjetoCtx);

/** Time for a closing dialog / popover / sheet to finish (focus return) before the project panel opens. */
const ESPERA_MS = 180;

/**
 * For lists inside a dialog, popover or another sheet: clicking a project FIRST closes the container
 * (`fechar`) and only then opens the project panel — never a sheet on top of a dialog.
 */
export function AbrirFechando({ fechar, children }: { fechar: () => void; children: ReactNode }) {
  const abrir = useAbrirProjeto();
  const fn = useCallback((p: Projeto) => {
    fechar();
    window.setTimeout(() => abrir?.(p), ESPERA_MS);
  }, [fechar, abrir]);
  return <AbrirProjetoCtx.Provider value={abrir ? fn : null}>{children}</AbrirProjetoCtx.Provider>;
}
