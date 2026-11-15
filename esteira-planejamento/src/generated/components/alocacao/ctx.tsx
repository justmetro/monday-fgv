import { cn } from '@lib/utils';
import type { Projeto } from '@generated/lib/format';
import { codigoDe } from '@generated/lib/format';
import {
  type AlocDados, type Destino, type GerenteAloc, type ModeloAlocacao, type Temp, type Capacidade, type RegraCapacidade,
  TEMPS, TEMP_ORDEM, TEMP_COR, COMPLEXIDADES, COMPLEX_COR, CAPS, CAP_COR, capRegraTexto, REGRA_CAPACIDADE_PADRAO, SEM_TEMP,
} from '@generated/lib/alocacao';
import type { AlocacaoApi } from '@generated/hooks/useAlocacao';
import type { GerenteMapa } from '@generated/hooks/useMapaGerentes';
import { ChipSelect } from '@generated/components/alocacao/bits';

export interface AlocCtx {
  modelo: ModeloAlocacao;
  dados: AlocDados;
  api: AlocacaoApi;
  /** Normalized search term ("Buscar projeto ou gerente…"). */
  q: string;
  eixoOpts: string[];
  base: Projeto[];
  onItem: (p: Projeto) => void;
  ddGerenteOpts: string[];
  perguntar: (p: { titulo?: string; texto: string; ok?: string }) => Promise<boolean>;
  /** Whole Mapa de Gerentes (read-only) — used by the Histórico. */
  mapa: GerenteMapa[];
  /** Forces a fresh read of the 02.01 base (skips the server cache). */
  recarregarBase: () => void;
  /** Adjustable capacity rule currently in effect (Disponibilidade → "Regra de capacidade"). */
  regra: RegraCapacidade;
  /** Opens the manager side panel (Mapa id). */
  abrirGerente: (id: string) => void;
  /** Sub-tabs report how many projects they list, so the header counter uses the open sub-tab's base. */
  reportarContagem: (sub: string, n: number) => void;
}

/** Manager name that opens the manager side panel. */
export function NomeGerente({ ctx, id, nome, className }: { ctx: AlocCtx; id: string; nome: string; className?: string }) {
  return (
    <button type="button" onClick={() => ctx.abrirGerente(id)} title={`${nome} — ver detalhes`}
      className={cn('min-w-0 rounded-[var(--radius-sm)] text-left font-medium text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      {nome}
    </button>
  );
}

const TEMP_NOTA = 'Calculado: Prospecção “Assinada” → Assinado; Prospecção “Pausado” → Negociação pausada; Status Planejamento “Novo Cadastro - 30 a 45 dias” / “- 45 a 60 dias” → essa faixa; senão Assinado se a assinatura é até hoje, ou pelos dias até a Data de Assinatura (≤ 30 → 15 a 30; 31–45 → 30 a 45; > 45 → 45 a 60). “Reforço imediato” e “Mudança de gestão” são só manuais. O valor revisado no app sempre prevalece.';

export function TempSel({ d, api }: { d: Destino; api: AlocacaoApi }) {
  return (
    <ChipSelect label="Temperatura de assinatura" valor={d.temp.valor} calc={d.temp.calc} ajuste={d.temp.ajuste}
      opcoes={TEMPS} corDe={(v) => TEMP_COR[(v ?? SEM_TEMP) as Temp] ?? '--temp-sem'}
      onChange={(v) => void api.ajustar('temperatura', d.p.id, v)} onReset={() => void api.voltarCalculado('temperatura', d.p.id)} nota={TEMP_NOTA} />
  );
}

export function ComplexSel({ d, api }: { d: Destino; api: AlocacaoApi }) {
  return (
    <ChipSelect label="Complexidade" valor={d.complex.valor} calc={d.complex.calc} ajuste={d.complex.ajuste}
      opcoes={COMPLEXIDADES} corDe={(v) => COMPLEX_COR[(v ?? '—') as keyof typeof COMPLEX_COR] ?? '--temp-sem'}
      onChange={(v) => void api.ajustar('complexidade', d.p.id, v)} onReset={() => void api.voltarCalculado('complexidade', d.p.id)}
      nota="Padrão: espelho “Faixa de Complexidade” do 02.01 (somente leitura)." />
  );
}

export function CapSel({ ga, api, valor, calc, regra }: { ga: GerenteAloc; api: AlocacaoApi; valor?: Capacidade; calc?: Capacidade; regra?: RegraCapacidade }) {
  return (
    <ChipSelect label="Capacidade" valor={valor ?? ga.cap.valor} calc={calc ?? ga.cap.calc} ajuste={ga.cap.ajuste}
      opcoes={CAPS} corDe={(v) => CAP_COR[(v ?? 'Não') as Capacidade] ?? '--farol-gray'}
      onChange={(v) => void api.ajustar('capacidade', ga.g.id, v)} onReset={() => void api.voltarCalculado('capacidade', ga.g.id)} nota={capRegraTexto(regra ?? REGRA_CAPACIDADE_PADRAO)} />
  );
}

export const rotuloProjeto = (p: Projeto) => `${codigoDe(p) ? `${codigoDe(p)} · ` : ''}${p.name}`;

/** Order index of a temperature for table sorting. */
export const ordemTemp = (t: Temp) => TEMP_ORDEM.indexOf(t);
