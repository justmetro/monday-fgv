import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// O quadro "Manual de Portais" não está mais conectado ao app (nenhum quadro do monday pode ficar conectado).
// A função continua existindo para a gaveta do manual mostrar o estado vazio sem erro.
export const getManualDePortais = createServerFn({ method: 'GET' })
  .validator(z.object({ search: z.string().optional() }).optional())
  .handler(async () => {
    return {
      success: true,
      items: [] as Array<{ id: string; name: string; sigla?: string; tipoDeConsulta?: string; resumo?: string; passos?: string; aviso?: string; linkDoPortal?: string }>,
    };
  });
