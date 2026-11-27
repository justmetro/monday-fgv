// Gravação de cada etapa no quadro [PLAN], pelo login de quem usa o hub.
import { CP, SUB, RESP_PLANEJAMENTO, criarItens, criarSubitens, alterarItens, itensDosGrupos, arquivarItens, faixa, diaParaData } from '@generated/lib/quadros';
import { gql } from '@generated/lib/monday';
import { txt } from '@generated/lib/monday';

export interface Produto {
  codigo: string; nome: string; descricao: string; objetivo: string; mes_inicio: number; mes_fim: number;
  dia_inicio: number | null; dia_fim: number | null; valor: number; fase: string; tipologia: string; tipo_entrega: string; fonte: string;
}
export interface Atividade { nome: string; dia_inicio: number; dia_fim: number; frente: string }
export interface Marco { nome: string; dia_inicio: number; dia_fim: number; atividades: Atividade[] }
export interface Entregavel { nome: string; dia_inicio: number; dia_fim: number; marcos: Marco[] }
export interface EapProduto { codigo: string; entregaveis: Entregavel[] }
export interface Risco {
  id: string; titulo: string; categoria: string; tema: string; impactado: string[]; causa: string; efeito: string;
  probabilidade: string; impacto: string; estrategia: string; resposta: string; cargo_responsavel: string; frente: string;
  dia_inicio: number; dia_fim: number; produtos: string[]; incluir?: boolean;
}
export interface Parte {
  nome: string; cargo_cliente: string; area: string; classe: string; papel: string[]; interesse: string; poder: string; expectativas: string; riscos_associados: string; incluir?: boolean;
}
export interface Indicador {
  nome: string; descricao: string; formula: string; meta: number; unidade: string; polaridade: string; temporalidade: string; coleta: string; medicoes: number[]; produtos: string[]; referencia?: string;
}
export interface Kr extends Indicador { kpis: Indicador[] }
export interface Objetivo { objetivo: string; krs: Kr[] }

/** Dias do produto: usa os dias do TR quando houver; senão converte meses contratuais em blocos de 30 dias. */
export function diasDoProduto(p: Pick<Produto, 'dia_inicio' | 'dia_fim' | 'mes_inicio' | 'mes_fim'>) {
  const ini = p.dia_inicio ?? (Math.max(1, p.mes_inicio || 1) - 1) * 30 + 1;
  const fim = p.dia_fim ?? Math.max(1, p.mes_fim || p.mes_inicio || 1) * 30;
  return { ini, fim: Math.max(ini, fim) };
}

// Itens de exemplo que o modelo v6 traz em cada grupo (são arquivados antes da primeira gravação)
const MODELO: Record<string, RegExp> = {
  [CP.grupos.produtos]: /^PRODUTO \d+$/i,
  [CP.grupos.cronograma]: /^(Criar item|\d+(\.\d+)*\.?\s*(COMPONENTE|PACOTE DE ENTREGAS)|hghghg)$/i,
  [CP.grupos.riscos]: /^RISCO \d+$/i,
  [CP.grupos.indicador]: /^INDICADOR (KR|KPI) \d+$/i,
  [CP.grupos.partes]: /^GRUPO \/ INSTITUI[ÇC][ÃA]O \d+$/i,
};

export async function limparModelo(boardId: string, grupo: string): Promise<number> {
  const rx = MODELO[grupo];
  if (!rx) return 0;
  const its = await itensDosGrupos(boardId, [grupo], ['name']);
  const ids = its.filter((it) => rx.test(it.name.trim())).map((it) => it.id);
  if (ids.length) await arquivarItens(ids);
  return ids.length;
}

/** Mostra os níveis 3 (marcos) e 4 (atividades) na aba "8. CRONOGRAMA" do quadro. */
export async function ajustarAbaCronograma(boardId: string) {
  const d = await gql(`query ($b: [ID!]) { boards(ids: $b) { columns(ids: ["${CP.eap}"]) { settings_str } views { id name } } }`, { b: [boardId] });
  const b = d?.boards?.[0];
  const labels: { id: number; name?: string; label?: string }[] = JSON.parse(b?.columns?.[0]?.settings_str || '{}').labels ?? [];
  const ids = labels.filter((l) => /n[ií]vel\s*[34]/i.test(l.name ?? l.label ?? '')).map((l) => l.id);
  // O settings_str demora a refletir rótulo criado na hora (Nível 4): completa com os ids gravados nos itens.
  if (ids.length < 2) {
    const itens = await itensDosGrupos(boardId, [CP.grupos.cronograma], [CP.eap]).catch(() => []);
    for (const it of itens) {
      const c = it.cols[CP.eap];
      if (!/n[ií]vel\s*[34]/i.test(c?.text ?? '')) continue;
      for (const id of (JSON.parse(c?.value || '{}').ids ?? []) as number[]) if (!ids.includes(id)) ids.push(id);
    }
  }
  const vista = (b?.views ?? []).find((v: any) => /cronograma/i.test(v.name) && !/gantt/i.test(v.name));
  if (!vista || !ids.length) return false;
  await gql(`mutation ($b: ID!, $v: ID!, $f: ItemsQueryGroup) { update_view(board_id: $b, view_id: $v, type: TABLE, filter: $f) { id } }`, {
    b: boardId, v: String(vista.id),
    f: { operator: 'and', groups: [
      { operator: 'and', rules: [{ column_id: 'group', compare_value: [CP.grupos.cronograma], operator: 'any_of' }] },
      { operator: 'and', rules: [{ column_id: CP.eap, compare_value: ids, operator: 'any_of' }] },
    ] },
  });
  return true;
}

const cortar = (s: string, n = 1900) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------- Produtos ----------
/** Colunas de um produto no grupo Produtos. */
export function valoresProduto(p: Produto, inicio: string | null): Record<string, unknown> {
    const v: Record<string, unknown> = {
      [CP.codigo]: p.codigo, [CP.descricao]: cortar(p.descricao), [CP.meses]: `M${p.mes_inicio} - M${p.mes_fim}`,
      [CP.valor]: String(p.valor ?? 0), [CP.objetivo]: cortar(p.objetivo || ''), [CP.categoriaInsumo]: { labels: ['PRODUTO'] }, person: RESP_PLANEJAMENTO,
    };
    if (p.tipo_entrega) v[CP.tipoEntrega] = { labels: [p.tipo_entrega] };
    if (/^Fase [1-4]$/.test(p.fase)) { v[CP.etapaProduto] = { label: p.fase }; v.color_mkyf9bv4 = { label: p.fase }; }
    if (inicio) { const d = diasDoProduto(p); v[CP.contratual] = faixa(inicio, d.ini, d.fim); }
    return v;
}

export async function gravarProdutos(boardId: string, produtos: Produto[], inicio: string | null, progresso: (m: string) => void): Promise<{ mapa: Record<string, string>; criados: number; atualizados: number }> {
  progresso('Arquivando os produtos de exemplo do modelo…');
  await limparModelo(boardId, CP.grupos.produtos);
  progresso('Conferindo produtos já existentes…');
  const existentes = await itensDosGrupos(boardId, [CP.grupos.produtos], [CP.codigo]);
  const porCodigo = new Map<string, string>();
  for (const it of existentes) {
    const cod = (txt(it.cols[CP.codigo]).trim() || it.name.match(/^\s*(P\d+)/i)?.[1] || '').toUpperCase();
    if (cod) porCodigo.set(cod, it.id);
  }
  const valores = (p: Produto) => valoresProduto(p, inicio);
  const novos = produtos.filter((p) => !porCodigo.has(p.codigo.toUpperCase()));
  const velhos = produtos.filter((p) => porCodigo.has(p.codigo.toUpperCase()));
  if (velhos.length) {
    progresso(`Atualizando ${velhos.length} produtos que já existiam…`);
    await alterarItens(boardId, velhos.map((p) => ({ id: porCodigo.get(p.codigo.toUpperCase())!, valores: valores(p) })));
  }
  if (novos.length) {
    const ids = await criarItens(boardId, CP.grupos.produtos, novos.map((p) => ({ nome: `${p.codigo} - ${p.nome}`, valores: valores(p) })), (n) => progresso(`Criando produtos ${n}/${novos.length}…`));
    novos.forEach((p, i) => porCodigo.set(p.codigo.toUpperCase(), ids[i]));
  }
  return { mapa: Object.fromEntries(porCodigo), criados: novos.length, atualizados: velhos.length };
}

export async function mapaProdutos(boardId: string): Promise<Record<string, string>> {
  const existentes = await itensDosGrupos(boardId, [CP.grupos.produtos], [CP.codigo]);
  const m: Record<string, string> = {};
  for (const it of existentes) {
    const cod = (txt(it.cols[CP.codigo]).trim() || it.name.match(/^\s*(P\d+)/i)?.[1] || '').toUpperCase();
    if (cod) m[cod] = it.id;
  }
  return m;
}

// ---------- Chaves de comparação ----------
/** Texto normalizado para casar itens da prévia com itens do quadro (sem acento, caixa, pontuação e numeração). */
export const norm = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^\s*\d+(\.\d+)*\.?\s*/, '').replace(/^\s*(entregavel|marco)\s*[|:–-]\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const tiraRotulo = (n: string) => n.replace(/^\s*(entreg[aá]vel|marco)\s*[|:–-]\s*/i, '').trim();
export const semNumero = (n: string) => tiraRotulo(n.replace(/^\s*\d+(\.\d+)*\.?\s*/, ''));

// ---------- EAP / Cronograma ----------
// Nível 2 e Nível 3 viram itens do grupo Cronograma; cada atividade (Nível 4) vira subitem do seu marco (Nível 3).
export interface LinhaEap { nivel: 2 | 3 | 4; codigo: string; nome: string; titulo: string; chave: string; pai?: string; valores: Record<string, unknown> }

export function linhasEap(eap: EapProduto[], ordem: string[], mapa: Record<string, string>, inicio: string): { linhas: LinhaEap[]; semProduto: string[] } {
  const linhas: LinhaEap[] = [];
  const semProduto: string[] = [];
  for (const p of eap) {
    const cod = p.codigo.toUpperCase();
    const k = ordem.indexOf(p.codigo) + 1 || ordem.length + 1;
    const pid = mapa[cod];
    if (!pid) semProduto.push(p.codigo);
    const rel = pid ? { [CP.produtoRel]: { item_ids: [Number(pid)] } } : {};
    p.entregaveis.forEach((e, ie) => {
      const n2 = `${k}.${ie + 1}.`;
      const t2 = tiraRotulo(e.nome);
      const c2 = `2|${cod}|${norm(t2)}`;
      linhas.push({ nivel: 2, codigo: cod, nome: `${n2} ${t2}`, titulo: t2, chave: c2, valores: { ...rel, [CP.eap]: { labels: ['Nível 2'] }, [CP.cronograma]: faixa(inicio, e.dia_inicio, e.dia_fim), [CP.status]: { label: 'Não Iniciado' }, person: RESP_PLANEJAMENTO } });
      e.marcos.forEach((m, im) => {
        const n3 = `${n2}${im + 1}.`;
        const t3 = tiraRotulo(m.nome);
        const c3 = `3|${cod}|${norm(t3)}`;
        linhas.push({ nivel: 3, codigo: cod, nome: `${n3} ${t3}`, titulo: t3, chave: c3, pai: c2, valores: { ...rel, [CP.eap]: { labels: ['Nível 3'] }, [CP.cronograma]: faixa(inicio, m.dia_inicio, m.dia_fim), [CP.status]: { label: 'Não Iniciado' }, person: RESP_PLANEJAMENTO } });
        m.atividades.forEach((a, ia) => {
          const v: Record<string, unknown> = { [SUB.cronograma]: faixa(inicio, a.dia_inicio, a.dia_fim), [SUB.status]: { label: 'Não Iniciado' }, [SUB.responsavel]: RESP_PLANEJAMENTO };
          if (a.frente) v[SUB.frentes] = { label: a.frente };
          linhas.push({ nivel: 4, codigo: cod, nome: `${n3}${ia + 1}. ${a.nome}`, titulo: a.nome, chave: `4|${c3}|${norm(a.nome)}`, pai: c3, valores: v });
        });
      });
    });
  }
  return { linhas, semProduto };
}

/** Cria as linhas da EAP: níveis 2 e 3 como itens, nível 4 como subitem do marco. `existentes` liga chaves de marcos já no quadro aos ids. */
export async function criarLinhasEap(boardId: string, linhas: LinhaEap[], existentes: Record<string, string>, progresso: (m: string) => void) {
  const itens = linhas.filter((l) => l.nivel !== 4);
  const ids = await criarItens(boardId, CP.grupos.cronograma, itens.map((l) => ({ nome: l.nome, valores: l.valores })), (n) => progresso(`Criando entregáveis e marcos ${n}/${itens.length}…`));
  const porChave: Record<string, string> = { ...existentes };
  itens.forEach((l, i) => { porChave[l.chave] = ids[i]; });
  const subs = linhas.filter((l) => l.nivel === 4 && l.pai && porChave[l.pai]);
  const semMarco = linhas.filter((l) => l.nivel === 4 && !(l.pai && porChave[l.pai])).length;
  const subIds = await criarSubitens(subs.map((l) => ({ pai: porChave[l.pai!], nome: l.nome, valores: l.valores })), (n) => progresso(`Criando atividades (subitens) ${n}/${subs.length}…`));
  return { ids: [...ids, ...subIds], porChave, semMarco };
}

export async function gravarEap(boardId: string, eap: EapProduto[], ordem: string[], mapa: Record<string, string>, inicio: string, progresso: (m: string) => void) {
  const { linhas, semProduto } = linhasEap(eap, ordem, mapa, inicio);
  progresso('Arquivando os itens de exemplo do modelo…');
  await limparModelo(boardId, CP.grupos.cronograma);
  const out = await criarLinhasEap(boardId, linhas, {}, progresso);
  progresso('Ajustando a aba 8. CRONOGRAMA para mostrar os marcos e suas atividades…');
  const aba = await ajustarAbaCronograma(boardId).catch(() => false);
  return { itens: out.ids.length, ids: out.ids, semProduto, aba };
}

// ---------- Riscos específicos (IA) ----------
export function valoresRisco(r: Risco, inicio: string | null): Record<string, unknown> {
  const v: Record<string, unknown> = {
    [CP.tema]: { labels: [r.tema] }, [CP.categoria]: { labels: [r.categoria] }, [CP.impactado]: { labels: r.impactado },
    [CP.causa]: { text: r.causa }, [CP.efeito]: { text: r.efeito }, [CP.prob]: { label: r.probabilidade }, [CP.imp]: { label: r.impacto },
    [CP.estrategia]: { label: r.estrategia }, [CP.resposta]: { text: r.resposta }, [CP.cargoResp]: r.cargo_responsavel,
    [CP.status]: { label: 'Não Iniciado' }, person: RESP_PLANEJAMENTO,
  };
  if (r.frente) v[CP.frentes] = { label: r.frente };
  if (inicio && r.dia_inicio && r.dia_fim) v[CP.periodo] = faixa(inicio, r.dia_inicio, r.dia_fim);
  if (r.produtos?.length) v[CP.riscosAssoc] = `Produtos: ${r.produtos.join(', ')}`;
  return v;
}

export async function gravarRiscosIA(boardId: string, riscos: Risco[], inicio: string | null, progresso: (m: string) => void) {
  const sel = riscos.filter((r) => r.incluir !== false);
  await limparModelo(boardId, CP.grupos.riscos);
  const ids = await criarItens(boardId, CP.grupos.riscos, sel.map((r) => ({ nome: `${r.id} | ${r.titulo}`, valores: valoresRisco(r, inicio) })), (n) => progresso(`Criando riscos ${n}/${sel.length}…`));
  return { n: sel.length, ids };
}

// ---------- Partes interessadas ----------
/** A FGV DGPE (contratada) nunca entra na matriz de partes interessadas. */
export const parteExterna = (p: Parte) => !/\bFGV\b|DGPE|contratada/i.test(`${p.nome} ${p.area} ${p.classe}`);

export function valoresParte(p: Parte): Record<string, unknown> {
  return {
    [CP.cargoCliente]: p.cargo_cliente, [CP.area]: `${p.area}${p.classe ? ` (${p.classe})` : ''}`, [CP.papel]: { labels: p.papel },
    [CP.interesse]: { label: p.interesse }, [CP.poder]: { label: p.poder }, [CP.expectativas]: { text: p.expectativas },
    [CP.riscosAssoc]: cortar(p.riscos_associados, 1000), [CP.status]: { label: 'Não Iniciado' }, person: RESP_PLANEJAMENTO,
  };
}

export async function gravarPartes(boardId: string, partes: Parte[], progresso: (m: string) => void) {
  const sel = partes.filter((p) => p.incluir !== false && parteExterna(p));
  await limparModelo(boardId, CP.grupos.partes);
  const ids = await criarItens(boardId, CP.grupos.partes, sel.map((p) => ({ nome: p.nome, valores: valoresParte(p) })), (n) => progresso(`Criando partes interessadas ${n}/${sel.length}…`));
  return { n: sel.length, ids };
}

// ---------- Indicadores (OKRs) ----------
// Unidades antigas do quadro para as unidades revisadas na padronização.
const UNIDADE: Record<string, string> = { '%': 'Percentual', NPS: 'Pontuação ou escala', Pessoa: 'Unidade', Projeto: 'Unidade', Dia: 'Unidade', Hora: 'Unidade', Professor: 'Unidade', Estudante: 'Unidade' };
export const unidadePadrao = (u: string) => UNIDADE[u] ?? u;
export type TipoInd = 'KR - Resultado Chave' | 'KPI - Resultado de Processo';

export function valoresIndicador(i: Indicador, tipo: TipoInd, objetivo: string): Record<string, unknown> {
  return {
    [CP.tipoInd]: { label: tipo }, [CP.descInd]: { text: i.descricao }, [CP.formula]: cortar(i.formula, 1000), [CP.meta]: String(i.meta ?? ''),
    [CP.unidade]: { labels: [unidadePadrao(i.unidade)] }, [CP.temporalidade]: { labels: [i.temporalidade] }, [CP.coleta]: { labels: [i.coleta] },
    [CP.polaridade]: { label: i.polaridade }, [CP.qtdMed]: String(i.medicoes?.length ?? 0), [CP.objetivo]: cortar(objetivo, 1000),
    [CP.statusMed]: { label: 'Em Planejamento' }, person: RESP_PLANEJAMENTO,
  };
}

/** Itens de medição de um indicador já criado no quadro. */
export function medicoesDe(ind: Indicador, id: string, inicio: string | null) {
  return (ind.medicoes ?? []).map((dia, k) => {
    const v: Record<string, unknown> = { [CP.meta]: String(ind.meta ?? ''), [CP.formula]: cortar(ind.formula, 1000), [CP.indVinculado]: { item_ids: [Number(id)] }, [CP.statusMed]: { label: 'Não Iniciado' }, person: RESP_PLANEJAMENTO };
    if (inicio) v[CP.prazoMed] = { date: diaParaData(inicio, dia) };
    return { nome: `Medição ${k + 1} - ${ind.nome}`, valores: v };
  });
}

export async function gravarIndicadores(boardId: string, objetivos: Objetivo[], inicio: string | null, progresso: (m: string) => void) {
  let nInd = 0;
  const ids: string[] = [];
  const medicoes: { nome: string; valores: Record<string, unknown> }[] = [];
  await limparModelo(boardId, CP.grupos.indicador);
  for (const o of objetivos) {
    const krIds = await criarItens(boardId, CP.grupos.indicador, o.krs.map((kr) => ({ nome: kr.nome, valores: valoresIndicador(kr, 'KR - Resultado Chave', o.objetivo) })), undefined, true);
    ids.push(...krIds);
    nInd += krIds.length;
    progresso(`Criando indicadores (${nInd})…`);
    for (let k = 0; k < o.krs.length; k++) {
      const kr = o.krs[k];
      medicoes.push(...medicoesDe(kr, krIds[k], inicio));
      if (kr.kpis?.length) {
        const kpiIds = await criarItens(boardId, CP.grupos.indicador, kr.kpis.map((kpi) => ({ nome: kpi.nome, valores: { ...valoresIndicador(kpi, 'KPI - Resultado de Processo', o.objetivo), [CP.krVinculado]: { item_ids: [Number(krIds[k])] } } })), undefined, true);
        ids.push(...kpiIds);
        nInd += kpiIds.length;
        kr.kpis.forEach((kpi, j) => medicoes.push(...medicoesDe(kpi, kpiIds[j], inicio)));
        progresso(`Criando indicadores (${nInd})…`);
      }
    }
  }
  if (medicoes.length) ids.push(...await criarItens(boardId, CP.grupos.medicao, medicoes, (n) => progresso(`Criando medições ${n}/${medicoes.length}…`)));
  return { indicadores: nInd, medicoes: medicoes.length, ids };
}
