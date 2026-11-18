import { useCallback, useEffect, useState } from 'react';
import { useMondayContext } from '@/context/MondayContextProvider';

export type Tema = 'light' | 'dark';
const CHAVE = 'esteira-tema';

const lerSalvo = (): Tema | null => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'light' || v === 'dark' ? v : null;
  } catch { return null; }
};

/** Tema do app: a escolha do botão (salva no navegador) ou, sem escolha, o tema da monday. Aplica a classe "dark" no <html>. */
export function useTema() {
  const { context } = useMondayContext();
  const doMonday: Tema = context?.theme === 'dark' || context?.theme === 'black' ? 'dark' : 'light';
  const [escolhido, setEscolhido] = useState<Tema | null>(lerSalvo);
  const tema = escolhido ?? doMonday;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
  }, [tema]);

  const alternar = useCallback(() => {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark';
    setEscolhido(novo);
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale só nesta sessão */ }
  }, [tema]);

  return { tema, alternar };
}
