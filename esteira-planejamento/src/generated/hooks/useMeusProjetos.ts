import { useEffect, useState } from 'react';
import { getMe } from '@generated/server/projetos';

const chave = (id: string) => `painel-esteira:meus-projetos:${id}`;

/**
 * Resolves the signed-in monday user and the remembered "Meus projetos" choice.
 * `ready` turns true once the stored choice was read (or could not be), so the
 * first project load already uses the right scope.
 */
export function useMeusProjetos() {
  const [meId, setMeId] = useState<string | null>(null);
  const [inicial, setInicial] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getMe({ data: {} })
      .then((res) => {
        if (!active) return;
        const id = res?.id ?? null;
        setMeId(id);
        if (id) {
          try {
            setInicial(window.localStorage.getItem(chave(id)) === '1');
          } catch {
            // Storage unavailable: just don't remember.
          }
        }
      })
      .catch((e: unknown) => console.error('Não foi possível identificar o usuário atual', e))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const lembrar = (on: boolean) => {
    if (!meId) return;
    try {
      window.localStorage.setItem(chave(meId), on ? '1' : '0');
    } catch {
      // Storage unavailable: just don't remember.
    }
  };

  return { meId, inicial, ready, lembrar };
}
