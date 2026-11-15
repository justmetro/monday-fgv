import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { listarGerentesCadastro } from '@generated/server/gerentes-cadastro';
import { obterMapa } from '@generated/server/mapa-dados';

/** Board "Mapa de Gerentes de Projeto" — READ ONLY. Never write to it. */

/** Options for the editable "Gerente" relation on 02.01: group "Gerentes" with Atividade = GERENTE. */
export const getGerentesRelacao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    return { gerentes: await listarGerentesCadastro(!!data.force) };
  });

/** Registrations + allocations of the Mapa; server cache 60 s (stale-while-revalidate), force skips it. */
export const getMapaGerentes = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => obterMapa(!!data?.force));
