import { useCallback, useEffect, useState } from 'react';

type Tema = 'claro' | 'escuro';
const KEY = 'painel-continuidade:tema';

function aplicar(t: Tema) {
  const root = document.documentElement;
  const dark = t === 'escuro';
  if (root.classList.contains('dark') !== dark) root.classList.toggle('dark', dark);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function lerSalvo(): Tema | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'claro' || v === 'escuro' ? v : null;
  } catch {
    return null; // armazenamento indisponível
  }
}

/** Modo escuro por padrão; o botão alterna para o claro. Preferência salva no navegador. */
export function useTema() {
  const [tema, setTema] = useState<Tema>('escuro');

  useEffect(() => {
    setTema(lerSalvo() ?? 'escuro');
  }, []);

  useEffect(() => {
    aplicar(tema);
    // O tema do monday pode ser reaplicado depois; mantém a escolha do app.
    const obs = new MutationObserver(() => aplicar(tema));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((atual) => {
      const next: Tema = atual === 'escuro' ? 'claro' : 'escuro';
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* ignora */
      }
      return next;
    });
  }, []);

  return { escuro: tema === 'escuro', alternar };
}
