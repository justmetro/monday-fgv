import { useCallback, useEffect, useRef, useState } from 'react';
import { getMapaGerentes } from '@generated/server/mapa';

export type Mapa = Awaited<ReturnType<typeof getMapaGerentes>>;
export type GerenteMapa = Mapa['gerentes'][number];

/** Loads the (read-only) Mapa de Gerentes board once; failures stay local to the Carga tab. */
export function useMapaGerentes(enabled: boolean) {
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const feito = useRef(-1);

  useEffect(() => {
    if (!enabled || feito.current === tentativa) return;
    feito.current = tentativa;
    let active = true;
    let terminou = false;
    setLoading(true);
    setError(null);
    // Retries (tentativa > 0) bypass the server cache.
    getMapaGerentes({ data: { force: tentativa > 0 } })
      .then((res) => {
        if (active) setMapa(res ?? null);
      })
      .catch((e: unknown) => {
        console.error('Erro ao carregar o Mapa de Gerentes', e);
        if (active) setError('Não foi possível carregar o Mapa de Gerentes de Projeto.');
      })
      .finally(() => {
        terminou = true;
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      // Interrupted before finishing (e.g. tab switched): allow a new attempt later.
      if (!terminou) feito.current = -1;
    };
  }, [enabled, tentativa]);

  const retry = useCallback(() => setTentativa((t) => t + 1), []);
  return { mapa, loading, error, retry };
}
