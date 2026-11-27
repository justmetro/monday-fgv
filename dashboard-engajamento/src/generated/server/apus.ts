import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { apusData, type ApusData } from '../../../server/apus';
import { resolveSession } from './session.server';

const claim = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();

/** APUS e totais de atualizações por projeto e semana (quadro Relatórios dos projetos). */
export const getApus = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claim, force: z.boolean().optional() }))
  .handler(async ({ data }): Promise<ApusData> => {
    const s = await resolveSession(data.clientClaim);
    return apusData(Boolean(data.force && s.canManage));
  });
