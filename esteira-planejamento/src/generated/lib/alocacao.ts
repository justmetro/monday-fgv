import { type Projeto, toDate, today, daysBetween, assinadaSemGerente } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';
import { isInativo } from '@generated/lib/board-options';
import { GROUP_ESTEIRA } from '@generated/lib/grupos';
import { canceladoAloc } from '@generated/lib/filtros';
import { isGerente, vincular } from '@generated/lib/carga';
import type { GerenteMapa } from '@generated/hooks/useMapaGerentes';
import type { AlocAjuste, AlocComentario, AlocProjecao, AlocHistorico, AlocImportPendente } from '@generated/models';

/** Same shape as a Vibe DB doc (declared here so client code never imports the server SDK). */
export interface Doc<T> { id: string; createdAt: number; updatedAt: number; createdBy: string; updatedBy: string; data: T }
export interface AlocDados {
  ajustes: Doc<AlocAjuste>[];
  comentarios: Doc<AlocComentario>[];
  projecoes: Doc<AlocProjecao>[];
  historico: Doc<AlocHistorico>[];
  importPendentes: Doc<AlocImportPendente>[];
}

// ---------- Temperatura ----------
export const PAUSADA = 'Negociação pausada';
export const SEM_TEMP = 'Sem temperatura';
/** Official order (lists, filters, columns, sorting). */
export const TEMPS = ['Reforço imediato', 'Assinado', '15 a 30 dias', '30 a 45 dias', '45 a 60 dias', 'Mudança de gestão', PAUSADA] as const;
export type Temp = (typeof TEMPS)[number] | typeof SEM_TEMP;
/** Same order; "Sem temperatura" right before "Negociação pausada". */
export const TEMP_ORDEM: Temp[] = [...TEMPS.filter((t) => t !== PAUSADA), SEM_TEMP, PAUSADA];
/** Temperatures that get a big-number card (everything but "Negociação pausada"). */
export const TEMP_CARDS: Temp[] = TEMP_ORDEM.filter((t) => t !== PAUSADA);

export const TEMP_COR: Record<Temp, string> = {
  'Reforço imediato': '--temp-reforco',
  Assinado: '--temp-assinado',
  '15 a 30 dias': '--temp-15',
  '30 a 45 dias': '--temp-30',
  '45 a 60 dias': '--temp-45',
  'Mudança de gestão': '--temp-mudanca',
  [PAUSADA]: '--farol-gray',
  [SEM_TEMP]: '--temp-sem',
};

const NOVO_30_45 = normNome('Novo Cadastro - 30 a 45 dias');
const NOVO_45_60 = normNome('Novo Cadastro - 45 a 60 dias');

/**
 * From the esteira columns (read-only): Prospecção "Assinada" → Assinado; Prospecção "Pausado" → Negociação pausada;
 * Status Planejamento "Novo Cadastro - 30 a 45 / 45 a 60 dias" → that band; else signature date ≤ today → Assinado,
 * otherwise days until the Data de Assinatura. A manual adjustment in the app always wins.
 */
export function tempCalculada(p: Projeto): Temp {
  const prosp = (p.statusProspeco ?? []).map(normNome);
  if (prosp.includes('assinada') && !canceladoAloc(p) && p.statusPlanejamento !== 'Pausado') return 'Assinado';
  if (prosp.includes('pausado')) return PAUSADA;
  const sp = normNome(p.statusPlanejamento);
  if (sp === NOVO_30_45) return '30 a 45 dias';
  if (sp === NOVO_45_60) return '45 a 60 dias';
  const d = toDate(p.dataDeAssinatura);
  const hoje = today();
  if (d && d.getTime() <= hoje.getTime()) return 'Assinado';
  if (!d) return SEM_TEMP;
  const dias = daysBetween(hoje, d);
  return dias <= 30 ? '15 a 30 dias' : dias <= 45 ? '30 a 45 dias' : '45 a 60 dias';
}

/** "Negociação pausada" stays in the tables but never in totals, donut or count cards. */
export const contaNoTotal = (d: { temp: { valor: Temp } }) => d.temp.valor !== PAUSADA;

// ---------- Projeto ativo ----------
const HIST_ATIVOS = ['execucao', 'encerramento', 'em planejamento'];
/** Values of the mirror "Status Histórico de Projetos" (normalized; several linked items are comma separated). */
export const statusHistorico = (p: Projeto) => (p.statusHistricoDeProjetos?.displayValue ?? '').split(',').map(normNome).filter(Boolean);

/**
 * Active project (filter "Somente ativos" and managers' capacity): mirror Status Histórico de Projetos =
 * Execução / Encerramento / Em Planejamento (accent/case-insensitive, "Em execução" too). Without a link to the
 * Histórico de Projetos: active when in the Esteira group and Status Planejamento not Finalizado/Pausado/Despriorizado/Sem planejamento.
 */
const REFORCO: Temp = 'Reforço imediato';

export function isAtivoAloc(p: Projeto): boolean {
  if (canceladoAloc(p) || p.statusPlanejamento === 'Pausado') return false;
  if (assinadaSemGerente(p)) return true;
  const h = statusHistorico(p);
  if (h.length) return h.some((s) => HIST_ATIVOS.includes(s) || HIST_ATIVOS.includes(s.replace(/^em /, '')));
  return p.group?.id === GROUP_ESTEIRA && !isInativo(p.statusPlanejamento);
}

// ---------- Complexidade ----------
export const COMPLEXIDADES = ['Alta', 'Média', 'Baixa'] as const;
export type Complexidade = (typeof COMPLEXIDADES)[number];
export const COMPLEX_COR: Record<Complexidade | '—', string> = { Alta: '--farol-red', Média: '--farol-yellow', Baixa: '--farol-green', '—': '--temp-sem' };

/** Mirror "Faixa de Complexidade (Espelho)" (read-only) normalized to Alta/Média/Baixa. */
export function complexCalculada(p: Projeto): Complexidade | null {
  const raw = p.faixaDeComplexidadeEspelho?.displayValue ?? '';
  const k = normNome(raw.split(',')[0]);
  return k === 'alta' ? 'Alta' : k === 'media' ? 'Média' : k === 'baixa' ? 'Baixa' : null;
}

// ---------- Capacidade ----------
export const CAPS = ['Curto prazo', 'Médio prazo', 'Longo prazo', 'Não'] as const;
export type Capacidade = (typeof CAPS)[number];
/** Same palette everywhere the app shows capacity: curto = azul, médio = rosa claro, longo = roxo. */
export const CAP_COR: Record<Capacidade, string> = {
  'Curto prazo': '--cap-curto', 'Médio prazo': '--cap-medio', 'Longo prazo': '--cap-longo', Não: '--farol-gray',
};
export const CAP_CURTO: Record<Capacidade, string> = { 'Curto prazo': 'Curto', 'Médio prazo': 'Médio', 'Longo prazo': 'Longo', Não: 'Sem cap.' };

/** Adjustable rule ("Regra de capacidade", Disponibilidade): default 30/60/90 days, editable in the app. */
export interface RegraCapacidade { curtoDias: number; medioDias: number; longoDias: number }
export const REGRA_CAPACIDADE_PADRAO: RegraCapacidade = { curtoDias: 30, medioDias: 60, longoDias: 90 };
export const capRegraTexto = (r: RegraCapacidade) =>
  `Pelo Último Produto Previsto mais próximo entre os projetos ativos: até ${r.curtoDias} dias = Curto; até ${r.medioDias} dias = Médio; até ${r.longoDias} dias = Longo; mais de ${r.longoDias} dias ou sem data = Não. Sem projeto ativo = Curto.`;
/** Kept for static tooltips that can't read the live rule; prefer capRegraTexto(regra) when it's available. */
export const CAP_REGRA = capRegraTexto(REGRA_CAPACIDADE_PADRAO);

/** Nearest Último Produto Previsto, in days (editable thresholds); no active project = Curto. */
export function capacidadeDe(datas: (Date | null)[], nAtivos: number, regra: RegraCapacidade = REGRA_CAPACIDADE_PADRAO): Capacidade {
  if (nAtivos === 0) return 'Curto prazo';
  const validas = datas.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  const prox = validas[0];
  if (!prox) return 'Não';
  const dias = daysBetween(today(), prox);
  if (dias <= regra.curtoDias) return 'Curto prazo';
  if (dias <= regra.medioDias) return 'Médio prazo';
  if (dias <= regra.longoDias) return 'Longo prazo';
  return 'Não';
}

// ---------- Destinos especiais ----------
/** External manager: destination option only, never counted in totals or capacity. */
export const EXTERNO_NOME = 'Kheitt Lamas';
export const isExterno = (nome: string | null | undefined) => normNome(nome) === normNome(EXTERNO_NOME);
export const LIMITE_DESTINOS = 3;
export const NOVO_GERENTE = 'Novo gerente';

// ---------- Tipo de projeção ----------
export type TipoProjecao = NonNullable<AlocProjecao['tipo']>;
export const tipoDe = (x: AlocProjecao): TipoProjecao => x.tipo ?? 'novo';
export const TIPO_LABEL: Record<TipoProjecao, string> = { novo: 'Novo', reforco: 'Reforço', troca: 'Troca' };

// ---------- Modelo ----------
export interface Ajustavel<T> { valor: T; calc: T; ajuste: Doc<AlocAjuste> | null }
export interface Destino {
  p: Projeto;
  temp: Ajustavel<Temp>;
  complex: Ajustavel<Complexidade | null>;
  /** Pending projections. */
  projecoes: Doc<AlocProjecao>[];
  ativo: boolean;
  /** The 02.01 "Gerente" relation already has a manager → "já alocado" (reforço / troca). */
  comGerente: boolean;
  desativado: Doc<AlocAjuste> | null;
  /** Validated to an internal manager in the app, but the 02.01 relation doesn't show a manager yet. */
  aguardandoSync: boolean;
  /** A pending projection points to a manager already in the 02.01 "Gerente" relation (still to validate). */
  gerenteJaNo0201: boolean;
}
export interface AtivoG { p: Projeto; data: Date | null }
export interface GerenteAloc {
  g: GerenteMapa;
  ativos: AtivoG[];
  encerrados: AtivoG[];
  termino: Date | null;
  eixos: { valor: string[]; calc: string[]; ajuste: Doc<AlocAjuste> | null };
  cap: Ajustavel<Capacidade>;
  comentario: Doc<AlocComentario> | null;
  projecoes: Doc<AlocProjecao>[];
  desativado: Doc<AlocAjuste> | null;
}
export interface FiltrosAloc { somenteAtivos: boolean; mostrarDesativados: boolean }

function ajusteDe(dados: AlocDados, tipo: AlocAjuste['tipo'], alvoId: string) {
  return dados.ajustes.find((a) => a.data.tipo === tipo && a.data.alvoId === alvoId) ?? null;
}

function destinoDe(p: Projeto, dados: AlocDados, projecoes: Doc<AlocProjecao>[]): Destino {
  const tc = tempCalculada(p);
  const ta = ajusteDe(dados, 'temperatura', p.id);
  const cc = complexCalculada(p);
  const ca = ajusteDe(dados, 'complexidade', p.id);
  const temp = { calc: tc, ajuste: ta, valor: (ta && (TEMP_ORDEM as string[]).includes(ta.data.valor) ? ta.data.valor : tc) as Temp };
  return {
    p,
    temp,
    complex: { calc: cc, ajuste: ca, valor: (ca && (COMPLEXIDADES as readonly string[]).includes(ca.data.valor) ? ca.data.valor : cc) as Complexidade | null },
    projecoes,
    // 'Reforço imediato' (manual or calculated) wins over every other rule: always active.
    ativo: temp.valor === REFORCO || isAtivoAloc(p),
    comGerente: (p.gerente?.linkedItems ?? []).length > 0,
    desativado: ajusteDe(dados, 'desativado', p.id),
    aguardandoSync: false,
    gerenteJaNo0201: false,
  };
}

export function montarAlocacao(
  baseBruta: Projeto[], mapa: GerenteMapa[], dados: AlocDados, filtros: FiltrosAloc, regra: RegraCapacidade = REGRA_CAPACIDADE_PADRAO,
) {
  // Cancelled projects never take part in Alocação (destinos, selectors, PDF import, validation, CSV, manager lists)
  // — except when the final temperature is 'Reforço imediato' (manual adjustment or calculated): those always stay.
  const reforco = new Set(dados.ajustes.filter((a) => a.data.tipo === 'temperatura' && a.data.valor === REFORCO).map((a) => a.data.alvoId));
  const ehReforco = (p: Projeto) => reforco.has(p.id) || (!ajusteDe(dados, 'temperatura', p.id) && tempCalculada(p) === REFORCO);
  // Projects with a PENDING projection (Validação) are never dropped by any rule.
  const comPendente = new Set(dados.projecoes.filter((x) => x.data.status === 'Pendente').map((x) => x.data.projetoId));
  const base = baseBruta.filter((p) => comPendente.has(p.id) || !canceladoAloc(p) || ehReforco(p));
  const porId = new Map(base.map((p) => [p.id, p]));
  const validadas = new Set(dados.projecoes.filter((x) => x.data.status === 'Validada').map((x) => x.data.projetoId));
  const pendentes = dados.projecoes.filter((x) => x.data.status === 'Pendente');
  const pendPorProjeto = new Map<string, Doc<AlocProjecao>[]>();
  for (const x of pendentes) pendPorProjeto.set(x.data.projetoId, [...(pendPorProjeto.get(x.data.projetoId) ?? []), x]);
  const ordenar = (a: Destino, b: Destino) => TEMP_ORDEM.indexOf(a.temp.valor) - TEMP_ORDEM.indexOf(b.temp.valor) || a.p.name.localeCompare(b.p.name, 'pt-BR');

  /** Every 02.01 item (Esteira + Histórico), for pickers, import matching and validation. */
  const validadasGerente = new Set(dados.projecoes.filter((x) => x.data.status === 'Validada' && x.data.destinoTipo === 'gerente').map((x) => x.data.projetoId));
  const todos = base.map((p) => {
    const d = destinoDe(p, dados, pendPorProjeto.get(p.id) ?? []);
    d.aguardandoSync = !d.comGerente && validadasGerente.has(p.id);
    const rel = p.gerente?.linkedItems ?? [];
    const relIds = new Set(rel.map((l) => String(l.id)));
    const relNomes = new Set(rel.map((l) => normNome(l.name)));
    d.gerenteJaNo0201 = d.projecoes.some((x) => !!x.data.gerenteId && (relIds.has(String(x.data.gerenteId)) || relNomes.has(normNome(x.data.gerenteNome))));
    return d;
  }).sort(ordenar);
  // Visible = filters "Somente ativos" / "Mostrar desativados"; a project without manager already validated
  // in the app (CDPE / externo / Novo gerente) leaves the list. Validated to an internal manager but the
  // 02.01 still without manager (stale read) stays visible, flagged "aguardando sincronizar".
  const destinos = todos.filter((d) => comPendente.has(d.p.id) || (
    (!filtros.somenteAtivos || d.ativo) && (filtros.mostrarDesativados || !d.desativado)
    && (d.comGerente || d.aguardandoSync || !validadas.has(d.p.id) || d.projecoes.length > 0)));

  // Projects per manager: ONLY the 02.01 "Gerente" column via vincular() (relation, dropdown fallback);
  // active = isAtivoAloc (or Reforço imediato); the rest are "Encerrados". The Mapa is used for the registry only.
  const { doProjeto } = vincular(base, mapa);
  const porGerente = new Map<string, Set<string>>();
  for (const [pid, v] of doProjeto) for (const g of v.gerentes) porGerente.set(g.id, (porGerente.get(g.id) ?? new Set()).add(pid));
  const porData = (a: AtivoG, b: AtivoG) => (a.data?.getTime() ?? Infinity) - (b.data?.getTime() ?? Infinity);

  const todosGerentes: GerenteAloc[] = mapa
    .filter((g) => g.cadastrado && isGerente(g) && !isExterno(g.nome))
    .map((g) => {
      // Projects of a manager come ONLY from the 02.01 "Gerente" column (relation first, dropdown fallback — vincular()).
      const ids = porGerente.get(g.id) ?? new Set<string>();
      const projetos = [...ids].map((pid) => porId.get(pid)).filter((p): p is Projeto => !!p)
        .map((p) => ({ p, data: toDate(p.ltimoProdutoPrevisto) }));
      const ehAtivo = (a: AtivoG) => ehReforco(a.p) || isAtivoAloc(a.p);
      const ativos = projetos.filter(ehAtivo).sort(porData);
      const encerrados = projetos.filter((a) => !ehAtivo(a)).sort(porData);
      const eixosCalc = [...new Set(ativos.flatMap((a) => a.p.eixo ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const ea = ajusteDe(dados, 'eixos', g.id);
      const capCalc = capacidadeDe(ativos.map((a) => a.data), ativos.length, regra);
      const capA = ajusteDe(dados, 'capacidade', g.id);
      return {
        g,
        ativos,
        encerrados,
        termino: ativos.find((a) => a.data)?.data ?? null,
        eixos: { calc: eixosCalc, ajuste: ea, valor: ea ? ea.data.valores : eixosCalc },
        cap: { calc: capCalc, ajuste: capA, valor: (capA && (CAPS as readonly string[]).includes(capA.data.valor) ? capA.data.valor : capCalc) as Capacidade },
        comentario: dados.comentarios.find((c) => c.data.escopo === 'gerente' && c.data.alvoId === g.id) ?? null,
        projecoes: pendentes.filter((x) => x.data.destinoTipo === 'gerente' && x.data.gerenteId === g.id),
        desativado: ajusteDe(dados, 'desativado', g.id),
      };
    })
    .sort((a, b) => a.g.nome.localeCompare(b.g.nome, 'pt-BR'));

  const externo = mapa.find((g) => isExterno(g.nome)) ?? null;
  return {
    todos,
    destinos,
    /** "Projeção novos projetos": no manager in the 02.01 relation. */
    // Pending projections classify the project (even when the 02.01 relation already has a manager).
    semGerente: destinos.filter((d) => !d.comGerente || d.projecoes.length > 0),
    /** Active (not deactivated) managers — the only ones in views, pickers and totals. */
    gerentes: todosGerentes.filter((g) => !g.desativado),
    desativados: todosGerentes.filter((g) => g.desativado),
    pendentes,
    porId,
    externo: { id: externo?.id ?? 'externo', nome: externo?.nome ?? EXTERNO_NOME },
    /** Single "Novo gerente": counts as 1 manager; number of projects projected to it. */
    novoGerente: { projetos: new Set(pendentes.filter((x) => x.data.destinoTipo === 'novo').map((x) => x.data.projetoId)).size },
  };
}

export type ModeloAlocacao = ReturnType<typeof montarAlocacao>;

/**
 * Capacity per manager (Mapa id) exactly as shown in Alocação de Gerentes: CAP_REGRA over the active
 * projects + manual "capacidade" adjustment ("Revisado") when present. Used by Capacidade por Gerente.
 */
export function capacidadesGerentes(
  base: Projeto[], mapa: GerenteMapa[], dados: AlocDados, regra: RegraCapacidade = REGRA_CAPACIDADE_PADRAO,
): Map<string, Capacidade> {
  const m = montarAlocacao(base, mapa, dados, { somenteAtivos: true, mostrarDesativados: true }, regra);
  return new Map([...m.gerentes, ...m.desativados].map((g) => [g.g.id, g.cap.valor]));
}

/** Internal projection (manager or CDPE) vs. external vs. "Novo gerente" vs. none. */
export function classificar(d: Destino): 'interno' | 'externo' | 'novo' | 'sem' {
  if (d.projecoes.some((x) => x.data.destinoTipo === 'gerente' || x.data.destinoTipo === 'cdpe')) return 'interno';
  if (d.projecoes.some((x) => x.data.destinoTipo === 'externo')) return 'externo';
  if (d.projecoes.some((x) => x.data.destinoTipo === 'novo')) return 'novo';
  return 'sem';
}

export const rotuloDestino = (x: AlocProjecao) =>
  x.destinoTipo === 'cdpe' ? 'CDPE (interno)' : x.destinoTipo === 'externo' ? `${x.gerenteNome || EXTERNO_NOME} (externo)` : x.destinoTipo === 'novo' ? NOVO_GERENTE : x.gerenteNome;

export const casa = (q: string, ...vals: (string | null | undefined)[]) => !q || vals.some((v) => normNome(v).includes(q));

/** Tab search on a project: name, code, client, UF, managers (relation, dropdown) and projected destinations. */
export const casaDestino = (q: string, d: Destino) => casa(q,
  d.p.name, d.p.cdigoProjeto, d.p.cliente, ...(d.p.uf ?? []), ...(d.p.gerente1 ?? []),
  ...(d.p.gerente?.linkedItems ?? []).map((l) => l.name), ...d.projecoes.map((x) => x.data.gerenteNome));

/** Tab search on a manager: their name or any of their active / projected projects. */
export const casaGerente = (q: string, g: GerenteAloc) => casa(q,
  g.g.nome, ...g.ativos.flatMap((a) => [a.p.name, a.p.cdigoProjeto, a.p.cliente, ...(a.p.uf ?? [])]), ...g.projecoes.map((x) => x.data.projetoNome));

/** Destination cards (internal / without internal / total), excluding "Negociação pausada". */
export function contagemDestinos(lista: Destino[]) {
  const validos = lista.filter(contaNoTotal);
  const interno = validos.filter((d) => classificar(d) === 'interno').length;
  const semProjecao = validos.filter((d) => classificar(d) === 'sem').length;
  // Only distinct managers: the single "Novo gerente" counts 1; each external person counts once.
  const naoInternos = validos.filter((d) => classificar(d) === 'novo' || classificar(d) === 'externo');
  const novos = naoInternos.some((d) => d.projecoes.some((x) => x.data.destinoTipo === 'novo')) ? 1 : 0;
  const externos = new Set(naoInternos.flatMap((d) => d.projecoes.filter((x) => x.data.destinoTipo === 'externo').map((x) => x.data.gerenteId || 'externo'))).size;
  const projetosNovo = naoInternos.filter((d) => classificar(d) === 'novo').length;
  return { interno, semProjecao, externos, novos, projetosNovo, semInterno: novos + externos, total: validos.length };
}

/**
 * Manager experience for a project, from their projects in the 02.01 (active + closed, the project itself excluded):
 * "Já gerenciou X projetos do eixo [eixo do projeto], Y na UF [UF do projeto]". null when the project has no eixo nor UF.
 */
export function experienciaTexto(ga: GerenteAloc, p: Projeto): string | null {
  const eixos = p.eixo ?? [];
  const ufs = p.uf ?? [];
  if (!eixos.length && !ufs.length) return null;
  const outros = [...ga.ativos, ...ga.encerrados].filter((a) => a.p.id !== p.id).map((a) => a.p);
  const n = (k: number) => `${k} projeto${k === 1 ? '' : 's'}`;
  const partes: string[] = [];
  if (eixos.length) partes.push(`${n(outros.filter((o) => (o.eixo ?? []).some((e) => eixos.includes(e))).length)} do eixo ${eixos.join(', ')}`);
  if (ufs.length) {
    const y = outros.filter((o) => (o.uf ?? []).some((u) => ufs.includes(u))).length;
    partes.push(eixos.length ? `${y} na UF ${ufs.join(', ')}` : `${n(y)} na UF ${ufs.join(', ')}`);
  }
  return `Já gerenciou ${partes.join(', ')}`;
}
