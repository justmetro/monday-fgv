import { z } from 'zod';

const s = z.string().max(400);
const ns = s.nullable();

export const pautaContext = z.object({
  fase: z.enum(['planejamento', 'execução', 'encerramento', 'não informada']),
  statusOriginal: ns,
  diasParaUltimaEntrega: z.number().nullable(),
  hoje: s,
  produtos: z.object({
    emAberto: z.number(),
    lista: z.array(z.object({
      nome: s, status: ns, periodo: ns, entrega: ns, indice: z.number(), nivel: s, semCronograma: z.boolean(),
      fatores: z.object({ planejamento: s, atrasadas: s, ritmo: s }),
      valor: ns, faturamento: ns, pagamento: ns,
      entregaAtrasada: z.boolean(), entregueSemFaturamento: z.boolean(), pagamentoPendente: z.boolean(),
      pendentes: z.array(z.object({ nome: s, tipo: s, status: ns, inicio: ns, fim: ns, atrasada: z.boolean() })).max(6),
    })).max(10),
  }),
  cronograma: z.object({
    abertas: z.number(), atrasadas: z.number(), semResponsavel: z.number(),
    porFrente: z.array(z.object({ frente: s, abertas: z.number(), atrasadas: z.number(), concluidasRecentes: z.number() })).max(15),
    criticas: z.array(z.object({ nome: s, frente: ns, responsaveis: s, status: ns, fimPlanejado: ns, saude: ns, motivo: s })).max(10),
  }),
  riscos: z.object({
    total: z.number(), ativos: z.number(),
    lista: z.array(z.object({
      nome: s, tema: ns, categoria: ns, nivel: ns, probabilidade: ns, impacto: ns, estrategia: ns, resposta: ns,
      responsaveis: s, ultimaAtualizacao: ns, causa: ns, efeito: ns, sinais: z.array(s).max(6),
    })).max(10),
    recorrentes: z.array(z.object({ tema: s, quantidade: z.number() })).max(8),
  }),
  indicadores: z.object({
    total: z.number(),
    medicoes: z.array(z.object({ indicador: s, medicao: s, motivo: s, prazo: ns, periodo: ns, meta: ns, valor: ns, resultado: ns, statusMeta: ns, responsaveis: s })).max(10),
    tendencias: z.array(z.object({ indicador: s, serie: z.array(z.object({ prazo: ns, valor: ns, resultado: ns })).max(6) })).max(8),
    semApuracao: z.array(s).max(8),
  }),
});
export type PautaContext = z.infer<typeof pautaContext>;
