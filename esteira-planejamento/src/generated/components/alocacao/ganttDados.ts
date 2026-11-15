import { useEffect, useMemo, useState } from 'react';
import { addMonths } from 'date-fns';
import type { Projeto } from '@generated/lib/format';
import { codigoDe, toDate, today, fmtDate } from '@generated/lib/format';
import { casaGerente, type Capacidade, type GerenteAloc, type ModeloAlocacao } from '@generated/lib/alocacao';
import { type Chegada, chegadaDe, fmtMeses } from '@generated/lib/chegada';

export interface Barra {
  key: string;
  p: Projeto;
  rotulo: string;
  titulo: string;
  ini: Date | null;
  fim: Date | null;
  /** Projection not validated yet. */
  pendente: boolean;
  /** Duration estimated (6 months) — no Vigência / execution dates. */
  fimEstimado: boolean;
  /** Pending projection: arrival forecast, months and their origin. */
  chegada?: Chegada;
  /** "Sem temperatura": no arrival forecast (bar drawn from today with a warning). */
  semPrevisao?: boolean;
  /** "Assinado" with a Data de Assinatura: the bar starts at that date. */
  inicioAssinatura?: boolean;
}
export interface LinhaGantt { g: GerenteAloc; cap: Capacidade; barras: Barra[] }

/** Manager rows (filtered by manager, eixo and search) with active-project bars + pending projections. Memoized. */
export function useLinhasGantt(modelo: ModeloAlocacao, sel: string[], eixo: string, q: string) {
  // "Today" changes only when the calendar day changes (checked every minute and on each data refresh),
  // so the memo stays stable within a day.
  const [dia, setDia] = useState(() => today().toDateString());
  useEffect(() => {
    const t = setInterval(() => { const d = today().toDateString(); setDia((x) => (x === d ? x : d)); }, 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { const d = today().toDateString(); setDia((x) => (x === d ? x : d)); }, [modelo]);
  const hoje = useMemo(() => new Date(dia), [dia]);
  const destinoPorId = useMemo(() => new Map(modelo.todos.map((d) => [d.p.id, d])), [modelo.todos]);

  const linhas = useMemo<LinhaGantt[]>(() => modelo.gerentes
    .filter((g) => (!sel.length || sel.includes(g.g.nome)) && (!eixo || g.eixos.valor.includes(eixo)) && casaGerente(q, g))
    .map((g) => {
      const barras: Barra[] = g.ativos.map((a) => ({
        key: a.p.id, p: a.p, rotulo: codigoDe(a.p) ?? a.p.name, ini: toDate(a.p.alocaoGerente), fim: a.data, pendente: false, fimEstimado: false,
        titulo: `${a.p.name}\nInício (Alocação Gerente): ${fmtDate(a.p.alocaoGerente)}\nÚltimo Produto Previsto: ${fmtDate(a.data)}`,
      }));
      for (const x of g.projecoes) {
        const d = destinoPorId.get(x.data.projetoId);
        if (!d) continue;
        // New project: arrival = today + days of the temperature; end = arrival + months (Vigência / contract / 6).
        const c = chegadaDe(d, hoje);
        // "Assinado": the projection starts at the Data de Assinatura (even in the past); without it, current rule.
        const assinatura = d.temp.valor === 'Assinado' ? toDate(d.p.dataDeAssinatura) : null;
        const ini = assinatura ?? c.inicio ?? hoje;
        const fim = addMonths(ini, c.meses);
        barras.push({
          key: `proj-${x.id}`, p: d.p, ini, fim, pendente: true, fimEstimado: c.origem === 'estimado', chegada: c, semPrevisao: !assinatura && !c.inicio,
          inicioAssinatura: !!assinatura,
          rotulo: `${codigoDe(d.p) ?? d.p.name} · Pendente · ${fmtMeses(c.meses)}${assinatura || c.inicio ? '' : ' · sem previsão de chegada'}`,
          titulo: [
            `Pendente (projeção não validada): ${d.p.name}`,
            `Temperatura: ${d.temp.valor}`,
            assinatura ? `Início pela data de assinatura: ${fmtDate(assinatura)}`
              : c.inicio ? `Chegada prevista: ${fmtDate(c.inicio)} (hoje + ${c.dias} dias)` : 'Chegada prevista: sem previsão (sem temperatura) — barra desenhada a partir de hoje',
            `${fmtMeses(c.meses)} · ${c.rotuloOrigem}`,
            `Fim previsto: ${fmtDate(fim)}`,
          ].join('\n'),
        });
      }
      return { g, cap: g.cap.valor, barras };
    }), [modelo.gerentes, destinoPorId, sel, eixo, q, hoje]);

  return { linhas, hoje };
}
