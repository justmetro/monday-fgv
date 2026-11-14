// Monta o PPT da Reunião Tática a partir do modelo e dos dados dos quadros (regras da skill reuniao-tatica-monitoramento).
import type { Encaminhamento, Produto } from './data';
import { Deck, shape, appendToShape, collectRiskModels, setBarChart, setShape, setTable, shapeText, tableRows, CORES_RISCO, type Para } from './pptx';
import { cap, codigo, corta, pl, resumoPendencia, curto, dia, ddmm, ddmmaa, ddmmaaaa, faixa, isoDe, lista, mi, pessoas, primeiroNome, soma, ano } from './util';

export type Coordenacao = 'SAE' | 'CDPE';
export interface Params { coord?: Coordenacao; limparPrioridades?: boolean; consulta: string; prodIni: string; prodFim: string; prevIni: string; prevFim: string; cadIni: string; cadFim: string }
export interface Resultado { bytes: Uint8Array; avisos: string[]; resumo: string[] }

const RISCO: Record<string, string> = { 'Alto Risco': 'Alto', 'Risco Moderado': 'Moderado', 'Sem Risco': 'Sem risco' };
const rk = (s: string) => RISCO[s] ?? 'Não avaliado';
const ORDEM = ['Não avaliado', 'Sem risco', 'Moderado', 'Alto'];
const pior = (xs: string[]) => xs.reduce((a, b) => (ORDEM.indexOf(b) > ORDEM.indexOf(a) ? b : a), 'Não avaliado');
const FECHADOS = new Set(['Concluído', 'Cancelado', 'Despriorizado']);
const aberto = (e: Encaminhamento) => !FECHADOS.has(e.status);

interface Grupo { cod: string; nome: string; curto: string; itens: Produto[]; valor: number; gestor: string }

function agrupar(itens: Produto[], gestorDe: (cod: string) => string): Grupo[] {
  const m = new Map<string, Produto[]>();
  for (const p of itens) { const k = codigo(p.projeto); m.set(k, [...(m.get(k) ?? []), p]); }
  return [...m.entries()].map(([cod, its]) => ({ cod, nome: its[0].projeto || 'Sem projeto', curto: curto(its[0].projeto), itens: its, valor: soma(its.map((i) => i.valor)), gestor: gestorDe(cod) }))
    .sort((a, b) => b.valor - a.valor);
}

export async function gerarPPT(base: ArrayBuffer | Uint8Array, todos: { produtos: Produto[]; encaminhamentos: Encaminhamento[] }, P: Params): Promise<Resultado> {
  // Recorte por coordenação (coluna Coordenação do Levantamento de Produtos); encaminhamentos seguem o projeto.
  let dados = todos;
  const avisosRecorte: string[] = [];
  if (P.coord) {
    const coordDe = new Map<string, string>();
    for (const p of todos.produtos) if (p.projeto && p.coord) coordDe.set(codigo(p.projeto), p.coord);
    const doRecorte = (proj: string) => coordDe.get(codigo(proj)) === P.coord;
    const encMon = todos.encaminhamentos.filter((e) => e.grupo === 'Monitoramento');
    const semCoord = encMon.filter((e) => !coordDe.get(codigo(e.projeto)));
    dados = { produtos: todos.produtos.filter((p) => p.coord === P.coord), encaminhamentos: todos.encaminhamentos.filter((e) => doRecorte(e.projeto)) };
    if (semCoord.length) avisosRecorte.push(`${pl(semCoord.length, 'encaminhamento do grupo Monitoramento não tem', 'encaminhamentos do grupo Monitoramento não têm')} coordenação identificada pelo projeto e ${semCoord.length === 1 ? 'ficou' : 'ficaram'} fora (sem projeto ou projeto sem coordenação no Levantamento de Produtos).`);
  }
  const deck = await Deck.open(base);
  const S: any[] = [];
  for (let n = 1; n <= 10; n++) S[n] = await deck.slide(n);
  const avisos: string[] = [...avisosRecorte];
  const resumo: string[] = [];
  const hoje = dia(P.consulta);
  const Y = ano(P.consulta);
  const consulta = ddmmaaaa(P.consulta);
  const dias = (iso: string) => hoje - dia(iso);
  const naJanela = (iso: string, a: string, b: string) => !!iso && dia(iso) >= dia(a) && dia(iso) <= dia(b);
  const risk = collectRiskModels(S.slice(3, 10).filter(Boolean));

  // ---------- gestor por projeto ----------
  const contGestor = new Map<string, Map<string, number>>();
  for (const e of dados.encaminhamentos) {
    if (!e.gestor || !e.projeto) continue;
    const k = codigo(e.projeto), g = primeiroNome(e.gestor);
    const m = contGestor.get(k) ?? new Map<string, number>();
    m.set(g, (m.get(g) ?? 0) + 1); contGestor.set(k, m);
  }
  const gestorModelo = new Map<string, string>();
  for (const [n, id] of [[3, 42], [4, 52]] as const) {
    try { for (const r of tableRows(S[n], id).slice(1)) if (/\d{4}\/\d{3}/.test(r[0])) gestorModelo.set(codigo(r[0]), r[r.length - 1].replace(/\*$/, '')); } catch { /* modelo diferente */ }
  }
  const semGestor = new Set<string>();
  const gestorDe = (cod: string) => {
    const m = contGestor.get(cod);
    if (m?.size) return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const g = gestorModelo.get(cod);
    if (g) { semGestor.add(cod); return g; }
    return '-';
  };

  const prods = dados.produtos.filter((p) => p.tipo !== 'PRODUTO N FATURÁVEL');
  const futuras = prods.filter((p) => [p.entrega, p.fat, p.pag].some((d) => d && dia(d) > hoje));
  if (futuras.length) avisos.push(`${pl(futuras.length, 'produto tem', 'produtos têm')} data real (entrega, faturamento ou pagamento) no futuro; foram considerados como estão no quadro.`);

  // ---------- slide 1: títulos e períodos ----------
  if (P.coord) setShape(S[1], 19, [{ tpl: 0, runs: [`REUNIÃO ${P.coord} |`] }, { tpl: 1, runs: [shapeText(S[1], 19).replace(/^.*\|/, '').trim() || 'COORDENAÇÃO DE MONITORAMENTO E OPERAÇÕES'] }]);
  setShape(S[1], 25, [
    { tpl: 0, runs: ['Período analisado'] },
    { tpl: 1, runs: [`Produtos: posição em ${ddmmaaaa(P.prodIni)} a ${ddmmaaaa(P.prodFim)}`] },
    { tpl: 2, runs: [`Previsibilidade: ${ddmmaaaa(P.prevIni)} a ${ddmmaaaa(P.prevFim)}`] },
    { tpl: 3, runs: [`Encaminhamentos: cadastros de ${ddmm(P.cadIni)} a ${ddmm(P.cadFim)} e pendências vencidas até ${ddmm(isoDe(hoje - 1))}`] },
  ]);

  // ---------- slide 3: atraso de faturamento ----------
  const atrFat = prods.filter((p) => p.entrega && ano(p.entrega) === Y && !p.fat && dias(p.entrega) > 15);
  const gFat = agrupar(atrFat, gestorDe);
  const totFat = soma(gFat.map((g) => g.valor));
  setShape(S[3], 40, `Faturamento: ${mi(totFat)} entregues e ainda não faturados`);
  setShape(S[3], 41, `Atraso de faturamento — por projeto (itens faturáveis, entregues em ${Y})`);
  const t3 = gFat.slice(0, 6);
  setTable(S[3], 42, t3.map((g) => [
    g.nome, String(g.itens.length), mi(g.valor), faixa(g.itens.map((i) => i.entrega)),
    `${Math.max(...g.itens.map((i) => dias(i.entrega)))} d`, pior(g.itens.map((i) => rk(i.riscoFat))),
    faixa(g.itens.map((i) => i.prevFat)), g.gestor,
  ]), risk, [5]);
  const fora3 = gFat.slice(6);
  setShape(S[3], 43, `Fonte: Monday, quadro Levantamento de Produtos (consulta em ${consulta}). Critério: itens faturáveis entregues em ${Y} há mais de 15 dias e sem data real de faturamento. Dias contados até ${ddmm(P.consulta)}.`
    + (fora3.length ? ` Fora da tabela: ${pl(fora3.length, 'projeto', 'projetos')}, ${pl(soma(fora3.map((g) => g.itens.length)), 'item', 'itens')}, ${mi(soma(fora3.map((g) => g.valor)))} (${lista(fora3.slice(0, 4).map((g) => g.curto))}${fora3.length > 4 ? ' e outros' : ''}).` : '')
    + ' Gestor = coluna Gestor do Quadro de Encaminhamentos.');
  resumo.push(`Atraso de faturamento: ${gFat.length} projetos, ${mi(totFat)}.`);

  // ---------- slide 4: atraso de pagamento ----------
  const atrPag = prods.filter((p) => p.fat && ano(p.fat) === Y && !p.pag && dias(p.fat) > 30);
  const gPag = agrupar(atrPag, gestorDe);
  const totPag = soma(gPag.map((g) => g.valor));
  setShape(S[4], 51, `Pagamento: ${mi(totPag)} faturados em atraso`);
  const linhaPag = (g: Grupo) => [
    g.nome, String(g.itens.length), mi(g.valor), ddmmaa(g.itens.map((i) => i.fat).sort()[0]),
    `${Math.max(...g.itens.map((i) => dias(i.fat)))} d`, pior(g.itens.map((i) => rk(i.riscoPag))), faixa(g.itens.map((i) => i.prevPag)), g.gestor,
  ];
  let rows4 = gPag.map(linhaPag);
  if (gPag.length > 8) {
    const resto = gPag.slice(7), its = resto.flatMap((g) => g.itens);
    rows4 = [...gPag.slice(0, 7).map(linhaPag), [
      `Demais (${resto.length}): ${lista(resto.slice(0, 5).map((g) => g.curto))}${resto.length > 5 ? ' e outros' : ''}`, String(its.length), mi(soma(its.map((i) => i.valor))),
      faixa(its.map((i) => i.fat)), `${Math.max(...its.map((i) => dias(i.fat)))} d`, pior(its.map((i) => rk(i.riscoPag))),
      faixa(its.map((i) => i.prevPag)), [...new Set(resto.map((g) => g.gestor))].join('/'),
    ]];
  }
  setTable(S[4], 52, rows4, risk, [5]);
  const pontos: string[] = [];
  if (gPag[0]) {
    const g = gPag[0];
    pontos.push(`${g.curto} concentra ${Math.round((g.valor / totPag) * 100)}% do valor (${mi(g.valor)}, ${g.itens.length} itens), com risco ${pior(g.itens.map((i) => rk(i.riscoPag))).toLowerCase()} e previsão de pagamento em ${faixa(g.itens.map((i) => i.prevPag))}.`);
  }
  const prevVenc = gPag.filter((g) => g.itens.some((i) => i.prevPag && dia(i.prevPag) < hoje));
  const valVenc = (g: Grupo) => soma(g.itens.filter((i) => i.prevPag && dia(i.prevPag) < hoje).map((i) => i.valor));
  if (prevVenc.length) pontos.push(`${lista(prevVenc.slice(0, 4).map((g) => `${g.curto} (${mi(valVenc(g))})`))} ${prevVenc.length > 1 ? 'tinham' : 'tinha'} previsão de pagamento já vencida e ${prevVenc.length > 1 ? 'seguem' : 'segue'} sem pagamento registrado.`);
  const mais90 = gPag.filter((g) => g.itens.some((i) => dias(i.fat) > 90));
  if (mais90.length) pontos.push(`${pl(mais90.length, 'projeto passa', 'projetos passam')} de 90 dias desde o faturamento: ${lista(mais90.slice(0, 4).map((g) => g.curto))}.`);
  setShape(S[4], 54, [{ runs: ['Pontos de atenção: ', pontos.join(' ') || 'nenhum projeto com pagamento em atraso.'] }]);
  const legado = prods.filter((p) => p.fat && ano(p.fat) < Y && !p.pag);
  const legAlto = agrupar(legado.filter((p) => rk(p.riscoPag) === 'Alto'), gestorDe);
  const legSemRisco = legado.filter((p) => rk(p.riscoPag) === 'Não avaliado');
  const bul: Para[] = [{ tpl: 0, runs: ['Com risco avaliado (Alto):'] }];
  legAlto.slice(0, 5).forEach((g) => bul.push({ tpl: 1, runs: [`${g.curto}: ${mi(g.valor)}`] }));
  if (legAlto.length > 5) bul.push({ tpl: 1, runs: [`Outros (${legAlto.length - 5}): ${mi(soma(legAlto.slice(5).map((g) => g.valor)))}`] });
  if (!legAlto.length) bul.push({ tpl: 1, runs: ['Nenhum'] });
  if (legSemRisco.length) bul.push({ tpl: 1, runs: [`Sem risco avaliado: ${legSemRisco.length} itens, ${mi(soma(legSemRisco.map((p) => p.valor)))}`] });
  setShape(S[4], 58, bul);
  setShape(S[4], 59, `Fonte: Monday, quadro Levantamento de Produtos (consulta em ${consulta}). Critério: faturados em ${Y}, mais de 30 dias entre o faturamento e ${ddmm(P.consulta)}, sem data real de pagamento. Gestor = coluna Gestor do Quadro de Encaminhamentos.`);
  resumo.push(`Atraso de pagamento: ${gPag.length} projetos, ${mi(totPag)}. Legado ${Y - 1} ou antes sem pagamento: ${legado.length} itens.`);

  // ---------- slides 5 e 6: previsões ----------
  const titJanela = `${ddmm(P.prevIni)} A ${ddmm(P.prevFim)}`;
  const prevF = prods.filter((p) => naJanela(p.prevFat, P.prevIni, P.prevFim) && !p.fat);
  const gPF = agrupar(prevF, gestorDe);
  const totPF = soma(gPF.map((g) => g.valor));
  const pendFat = (g: Grupo) => {
    const ent = g.itens.filter((i) => i.entrega);
    const semEmp = g.itens.filter((i) => i.empenho === 'Sem empenho' || !i.empenho).length;
    const partes = [
      ent.length === g.itens.length ? `entregues ${ent.length > 1 ? 'de' : 'em'} ${faixa(ent.map((i) => i.entrega)).replace('–', ' a ')}` : ent.length ? `${ent.length} de ${g.itens.length} entregues` : 'sem data real de entrega',
      semEmp === g.itens.length ? 'sem empenho' : semEmp ? 'parte sem empenho' : 'empenhados',
    ];
    if (g.itens.every((i) => dia(i.prevFat) < hoje)) partes.push('previsão já passou');
    return cap(partes.join('; '));
  };
  setShape(S[5], 66, `PREVISÃO DE FATURAMENTO | ${titJanela}`);
  setShape(S[5], 67, `Até ${ddmm(P.prevFim)}: ${mi(totPF)} a faturar`);
  const top5 = gPF.slice(0, 7);
  const c5 = await deck.chartOf(5);
  if (c5) {
    const cats = top5.map((g) => g.curto), vals = top5.map((g) => g.valor / 1e6);
    setBarChart(c5.doc, cats, vals, top5.map((g) => CORES_RISCO[pior(g.itens.map((i) => rk(i.riscoFat)))]));
    await deck.setChartWorkbook(c5.path, 'R$ mi', cats, vals);
  }
  setTable(S[5], 71, top5.map((g) => [g.curto, String(g.itens.length), mi(g.valor), faixa(g.itens.map((i) => i.prevFat)), pior(g.itens.map((i) => rk(i.riscoFat))), pendFat(g)]), risk, [4]);
  const acoesF = gPF.slice(0, 4).map((g, k) => {
    const semEmp = g.itens.some((i) => i.empenho === 'Sem empenho' || !i.empenho);
    const naoEnt = g.itens.some((i) => !i.entrega);
    const verbo = naoEnt && semEmp ? 'confirmar entrega e empenho de' : semEmp ? 'regularizar o empenho e emitir as notas de' : naoEnt ? 'confirmar a entrega de' : 'emitir as notas de';
    return `(${k + 1}) ${verbo} ${g.curto} (${pl(g.itens.length, 'item', 'itens')}, ${mi(g.valor)}, previsão ${faixa(g.itens.map((i) => i.prevFat))})`;
  });
  const vencFTodos = prods.filter((p) => p.prevFat && dia(p.prevFat) < dia(P.prevIni) && !p.fat);
  const vencFPagos = vencFTodos.filter((p) => p.pag);
  const vencF = vencFTodos.filter((p) => !p.pag);
  console.log(`[Reunião Tática] Previsões de faturamento vencidas (antes de ${ddmm(P.prevIni)}, sem data real de faturamento): ${vencF.length}`);
  console.table(vencFTodos.map((p) => ({ id: p.id, projeto: p.projeto, tipo: p.tipo, valor: p.valor, previsao_fat: p.prevFat, data_real_fat: p.fat || '', data_real_pag: p.pag || '' })));
  if (vencFPagos.length) avisos.push(`${pl(vencFPagos.length, 'item tem', 'itens têm')} data real de pagamento mas não de faturamento (${lista([...new Set(vencFPagos.map((p) => curto(p.projeto)))])}); ficaram fora das previsões de faturamento vencidas. Conferir a data de faturamento no quadro.`);
  const recentesF = prods.filter((p) => p.fat && dias(p.fat) >= 0 && dias(p.fat) <= 7);
  setShape(S[5], 73, [{ runs: ['Ações preventivas: ', `${acoesF.join('; ') || 'nenhuma previsão de faturamento na janela'}.`
    + (recentesF.length ? ` Nos últimos 7 dias ${recentesF.length === 1 ? 'foi faturado 1 item' : `foram faturados ${recentesF.length} itens`} (${mi(soma(recentesF.map((p) => p.valor)))}).` : '')
    + (vencF.length ? ` Previsões de faturamento já vencidas e sem data real: ${pl(vencF.length, 'item', 'itens')}, ${mi(soma(vencF.map((p) => p.valor)))}${vencF.length <= 3 ? ` (${lista([...new Set(vencF.map((p) => curto(p.projeto)))])})` : ''}.` : '')] }]);
  setShape(S[5], 74, `Fonte: Monday, quadro Levantamento de Produtos (consulta em ${consulta}). Itens com Previsão de Faturamento entre ${ddmm(P.prevIni)} e ${ddmmaaaa(P.prevFim)} e sem data real. Criticidade = coluna 'Risco no Faturamento'.`
    + (gPF.length > 7 ? ` Fora do gráfico: ${pl(gPF.length - 7, 'projeto', 'projetos')}, ${mi(soma(gPF.slice(7).map((g) => g.valor)))}.` : ''));

  const prevPAll = prods.filter((p) => naJanela(p.prevPag, P.prevIni, P.prevFim) && !p.pag);
  const prevP = prevPAll.filter((p) => p.fat);
  const naoFat = agrupar(prevPAll.filter((p) => !p.fat), gestorDe);
  const gPP = agrupar(prevP, gestorDe);
  const totPP = soma(gPP.map((g) => g.valor));
  setShape(S[6], 81, `PREVISÃO DE PAGAMENTO | ${titJanela}`);
  setShape(S[6], 82, `Até ${ddmm(P.prevFim)}: ${mi(totPP)} a pagar`);
  const top6 = gPP.slice(0, 7);
  const c6 = await deck.chartOf(6);
  if (c6) {
    const cats = top6.map((g) => g.curto), vals = top6.map((g) => g.valor / 1e6);
    setBarChart(c6.doc, cats, vals, top6.map((g) => CORES_RISCO[pior(g.itens.map((i) => rk(i.riscoPag)))]));
    await deck.setChartWorkbook(c6.path, 'R$ mi', cats, vals);
  }
  const pendPag = (g: Grupo) => {
    const f = g.itens.map((i) => i.fat).sort()[0];
    const d = dias(f);
    const partes = [`${g.itens.every((i) => dia(i.prevPag) < hoje) ? 'previsão vencida; ' : ''}faturado em ${ano(f) < Y ? ddmmaaaa(f) : ddmm(f)} (${pl(d, 'dia', 'dias')})`];
    if (g.itens.some((i) => i.empenho === 'Sem empenho')) partes.push('sem empenho');
    else if (d <= 30) partes.push('dentro do prazo');
    return cap(partes.join('; '));
  };
  setTable(S[6], 86, top6.map((g) => [g.curto, String(g.itens.length), mi(g.valor), faixa(g.itens.map((i) => i.prevPag)), pior(g.itens.map((i) => rk(i.riscoPag))), pendPag(g)]), risk, [4]);
  const acoesP = gPP.slice(0, 4).map((g, k) => {
    const venc = g.itens.every((i) => dia(i.prevPag) < hoje);
    return `(${k + 1}) cobrar o pagamento de ${g.curto} (${mi(g.valor)}, previsão ${faixa(g.itens.map((i) => i.prevPag))}${venc ? ', vencida' : ''})`;
  });
  const vencLeg = prods.filter((p) => p.fat && ano(p.fat) < Y && !p.pag && p.prevPag && dia(p.prevPag) < hoje);
  setShape(S[6], 88, [{ runs: ['Ações preventivas: ', `${acoesP.join('; ') || 'nenhuma previsão de pagamento na janela'}.`
    + (vencLeg.length ? ` Previsões de pagamento já vencidas do legado faturado até ${Y - 1}: ${pl(vencLeg.length, 'item', 'itens')}, ${mi(soma(vencLeg.map((p) => p.valor)))}.` : '')] }]);
  setShape(S[6], 89, `Fonte: Monday, quadro Levantamento de Produtos (consulta em ${consulta}). Itens faturados com Previsão de Pagamento entre ${ddmm(P.prevIni)} e ${ddmmaaaa(P.prevFim)} e sem data real.`
    + (naoFat.length ? ` Ainda não faturados, mas com previsão de pagamento na janela: ${lista(naoFat.slice(0, 3).map((g) => `${g.curto} (${mi(g.valor)})`))}.` : '')
    + ` Criticidade = coluna 'Risco no Pagamento'.`);
  resumo.push(`Previsões na janela: faturamento ${mi(totPF)} (${gPF.length} projetos), pagamento ${mi(totPP)} (${gPP.length} projetos).`);

  // ---------- slide 7: matriz ----------
  interface Exp { cod: string; curto: string; gestor: string; fat: Produto[]; pag: Produto[] }
  const exp = new Map<string, Exp>();
  const add = (p: Produto, tipo: 'fat' | 'pag') => {
    const k = codigo(p.projeto);
    const e = exp.get(k) ?? { cod: k, curto: curto(p.projeto), gestor: gestorDe(k), fat: [], pag: [] };
    if (!e[tipo].some((x) => x.id === p.id)) e[tipo].push(p);
    exp.set(k, e);
  };
  [...atrFat, ...prevF].forEach((p) => add(p, 'fat'));
  [...atrPag, ...prevP, ...legado.filter((p) => rk(p.riscoPag) === 'Alto')].forEach((p) => add(p, 'pag'));
  const limite = dia(P.prevFim);
  const quad: Record<string, { txt: string; v: number }[]> = { agir: [], planejar: [], rapido: [], acompanhar: [] };
  for (const e of exp.values()) {
    const vf = soma(e.fat.map((p) => p.valor)), vp = soma(e.pag.map((p) => p.valor)), v = vf + vp;
    const urg = [...e.fat.map((p) => p.prevFat), ...e.pag.map((p) => p.prevPag)].some((d) => d && dia(d) <= limite)
      || e.fat.some((p) => p.entrega && dias(p.entrega) > 90) || e.pag.some((p) => p.fat && ano(p.fat) === Y && dias(p.fat) > 90);
    const riscoAlto = [...e.fat.map((p) => rk(p.riscoFat)), ...e.pag.map((p) => rk(p.riscoPag))].includes('Alto');
    const semEmp = e.fat.some((p) => p.empenho === 'Sem empenho');
    const partes = [vf ? `fat. ${mi(vf)}` : '', vp ? `pag. ${mi(vp)}` : ''].filter(Boolean).join(' + ');
    const det = [riscoAlto ? 'risco alto' : '', semEmp ? 'sem empenho' : ''].filter(Boolean).join(', ');
    const alto = v > 5e6;
    const txt = `${alto && urg && riscoAlto ? '★ ' : ''}${e.curto}: ${partes}${det ? ` (${det})` : ''}${e.gestor !== '-' ? ` | ${e.gestor}` : ''}`;
    quad[alto ? (urg ? 'agir' : 'planejar') : urg ? 'rapido' : 'acompanhar'].push({ txt, v });
  }
  for (const k of Object.keys(quad)) quad[k].sort((a, b) => b.v - a.v);
  setShape(S[7], 97, `ATUAR ATÉ ${ddmm(P.prevFim)}`);
  setShape(S[7], 98, `ATUAR APÓS ${ddmm(P.prevFim)} OU ROTINA`);
  const caixa = (id: number, titulo: string, linhas: string[]) => setShape(S[7], id, [{ tpl: 0, runs: [titulo] }, ...linhas.map((l) => ({ tpl: 1, runs: [l] }))]);
  const [t100, t102, t104, t106] = [100, 102, 104, 106].map((id) => primeiroPara(S[7], id));
  const extra = (arr: { txt: string }[], n: number) => (!arr.length ? ['Nenhum projeto nesta faixa'] : arr.length > n ? [...arr.slice(0, n - 1).map((x) => x.txt), `Outros ${pl(arr.length - n + 1, 'projeto', 'projetos')}`] : arr.map((x) => x.txt));
  caixa(100, t100, extra(quad.agir, 6));
  caixa(102, t102, extra(quad.planejar, 5));
  caixa(104, t104, extra(quad.rapido, 5));
  const acompanhar = quad.acompanhar.length || !legSemRisco.length ? extra(quad.acompanhar, 3) : [];
  if (legSemRisco.length) acompanhar.push(`Legado: ${pl(legSemRisco.length, 'item', 'itens')} (${mi(soma(legSemRisco.map((p) => p.valor)))}) sem risco de pagamento avaliado`);
  caixa(106, t106, acompanhar);
  setShape(S[7], 107, `Fonte: Monday, quadros Levantamento de Produtos e de Encaminhamentos (consulta em ${consulta}). Impacto alto = mais de R$ 5 mi expostos. Urgência = previsão até ${ddmm(P.prevFim)} ou atraso acima de 90 dias. ★ = impacto alto, urgente e com risco alto. Responsável proposto, a confirmar.`);

  // ---------- slide 8: encaminhamentos cadastrados ----------
  const E = dados.encaminhamentos.filter((e) => e.grupo === 'Monitoramento' && e.origem === 'Encaminhamento');
  const demandas = dados.encaminhamentos.filter((e) => e.grupo === 'Monitoramento' && e.origem !== 'Encaminhamento').length;
  const cad = E.filter((e) => naJanela(e.reuniao, P.cadIni, P.cadFim));
  const n = (st: string) => cad.filter((e) => e.status === st).length;
  const abertos = cad.filter(aberto);
  const fechadosCad = cad.length - abertos.length;
  setShape(S[8], 114, `ENCAMINHAMENTOS CADASTRADOS | ${ddmm(P.cadIni)} A ${ddmmaaaa(P.cadFim)}`);
  setShape(S[8], 115, `${cad.length} novos encaminhamentos; ${fechadosCad} concluídos e ${abertos.length} ainda abertos`);
  setShape(S[8], 118, String(n('Concluído') + n('Cancelado') + n('Despriorizado')));
  setShape(S[8], 122, String(n('Em Progresso')));
  setShape(S[8], 126, String(n('Não Iniciado')));
  setShape(S[8], 130, String(cad.filter((e) => !e.status).length));
  const porGestor = new Map<string, Encaminhamento[]>();
  for (const e of cad) { const g = primeiroNome(e.gestor); if (g) porGestor.set(g, [...(porGestor.get(g) ?? []), e]); }
  const gestRows = [...porGestor.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)
    .map(([g, es]) => [g, String(es.length), String(es.filter(aberto).length)]);
  const semGR = cad.filter((e) => !e.gestor || !e.resp);
  setTable(S[8], 132, [...gestRows, ['Sem gestor/responsável', String(semGR.length), String(semGR.filter(aberto).length)]], risk);
  const pend: Para[] = [{ tpl: 0, runs: ['Principais pendências identificadas'] }];
  const semInfo = cad.filter((e) => !e.status || !e.gestor || !e.resp).length;
  pend.push({ tpl: 1, runs: [`${abertos.length} dos ${cad.length} cadastros seguem abertos (${n('Não Iniciado')} não iniciados e ${n('Em Progresso')} em progresso); ${semInfo ? `${semInfo} sem status, gestor ou responsável` : 'nenhum está sem status, gestor ou responsável'}`] });
  const datas = [...new Set(cad.map((e) => e.reuniao))].sort();
  const ult = datas[datas.length - 1];
  if (ult) {
    const doDia = cad.filter((e) => e.reuniao === ult), ab = doDia.filter(aberto);
    const prazos = ab.map((e) => e.prazo).filter(Boolean);
    const pz = [...new Set(prazos)].sort();
    const quando = !pz.length ? '' : pz.length === 1 ? ` e ${ab.length === 1 ? 'vence' : 'vencem'} em ${ddmm(pz[0])}` : ` e vencem entre ${ddmm(pz[0])} e ${ddmm(pz[pz.length - 1])}`;
    const projs = lista([...new Set(ab.map((e) => curto(e.projeto)))].slice(0, 4));
    pend.push({ tpl: 1, runs: [!ab.length
      ? (doDia.length === 1 ? `O encaminhamento cadastrado em ${ddmm(ult)} foi concluído` : `Os ${doDia.length} encaminhamentos cadastrados em ${ddmm(ult)} foram concluídos`)
      : `${ab.length} ${doDia.length === 1 ? 'do 1 encaminhamento cadastrado' : `dos ${doDia.length} encaminhamentos cadastrados`} em ${ddmm(ult)} ${ab.length === 1 ? 'segue aberto' : 'seguem abertos'} (${projs})${quando}`] });
  }
  const vencCad = abertos.filter((e) => e.prazo && dia(e.prazo) < hoje);
  if (vencCad.length) {
    const pg = new Map<string, number>();
    vencCad.forEach((e) => { const g = primeiroNome(e.gestor) || 'sem gestor'; pg.set(g, (pg.get(g) ?? 0) + 1); });
    pend.push({ tpl: 1, runs: [`${pl(vencCad.length, 'cadastro aberto já vencido', 'cadastros abertos já vencidos')} (prazo até ${ddmm(isoDe(hoje - 1))}): ${lista([...pg.entries()].sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g} ${c}`))} (ex.: ${lista([...new Set(vencCad.map((e) => curto(e.projeto)))].slice(0, 4))})`] });
  }
  setShape(S[8], 134, pend);
  const porData = datas.map((d) => `${cad.filter((e) => e.reuniao === d).length} em ${ddmm(d)}`);
  setShape(S[8], 135, `Fonte: Monday, Quadro de Encaminhamentos, grupo Monitoramento, origem Encaminhamento (exclui ${demandas} demandas operacionais), consulta em ${consulta}. Cadastro pela Data da Reunião: ${lista(porData) || 'nenhum'}. Concluídos inclui cancelados e despriorizados. Gestor = coluna Gestor.`);
  const retro = cad.filter((e) => e.prazo && e.reuniao && dia(e.prazo) < dia(e.reuniao));
  if (retro.length) avisos.push(`${pl(retro.length, 'encaminhamento da janela tem', 'encaminhamentos da janela têm')} prazo anterior à data da reunião (possível cadastro retroativo).`);
  const semPrazo = E.filter((e) => aberto(e) && !e.prazo);
  if (semPrazo.length) avisos.push(`${pl(semPrazo.length, 'encaminhamento aberto está', 'encaminhamentos abertos estão')} sem prazo.`);

  // ---------- slide 9: vencidos e críticos ----------
  const venc = E.filter((e) => aberto(e) && e.prazo && dia(e.prazo) < hoje).map((e) => ({ e, d: dias(e.prazo), crit: e.prioridade === 'Alta' || dias(e.prazo) > 30 }));
  const crit = venc.filter((v) => v.crit);
  setShape(S[9], 143, `${venc.length} vencidos, ${crit.length} críticos`);
  const expPorCod = new Map([...exp.values()].map((x) => [x.cod, soma([...x.fat, ...x.pag].map((p) => p.valor))]));
  // agrupa registros do mesmo projeto e do mesmo tema numa linha só
  const grupos9 = new Map<string, typeof venc>();
  for (const v of venc) {
    const k = `${codigo(v.e.projeto)}|${tema(v.e.nome).id}`;
    grupos9.set(k, [...(grupos9.get(k) ?? []), v]);
  }
  const linhas9 = [...grupos9.values()].map((vs) => {
    vs.sort((a, b) => b.d - a.d);
    const t = tema(vs[0].e.nome);
    const c = vs.some((v) => v.crit);
    const d = vs[0].d;
    const val = expPorCod.get(codigo(vs[0].e.projeto));
    const desc = vs.length > 1 ? `${cap(t.rotulo)}, ${vs.length} registros` : resumoPendencia(vs[0].e.nome, 95);
    const passo = (t.id === 'pagamento' || t.id === 'faturamento') && val ? `${t.passo} (exposição de ${mi(val)})` : t.passo;
    const resp = pessoas([...new Set(vs.flatMap((v) => v.e.resp.split(',').map((x) => x.trim())).filter(Boolean))].join(', '));
    return { c, d, row: [c ? 'C' : 'R', curto(vs[0].e.projeto), desc, ddmm(vs.map((v) => v.e.prazo).sort()[0]), String(d), resp, passo, primeiroNome(vs[0].e.gestor) || '-'] };
  }).sort((a, b) => Number(b.c) - Number(a.c) || b.d - a.d);
  setTable(S[9], 144, linhas9.slice(0, 8).map((l) => l.row), risk, [], [0]);
  setShape(S[9], 145, `Fonte: Monday, Quadro de Encaminhamentos, grupo Monitoramento (origem Encaminhamento), consulta em ${consulta}. Atraso em dias corridos até ${ddmm(P.consulta)} (${venc.length} vencidos, ${venc.filter((v) => v.d > 30).length} há mais de 30 dias). Críticos = prioridade Alta ou mais de 30 dias de atraso. Exposição financeira cruzada com o Levantamento de Produtos. Classe: C = crítico; R = risco. Registros do mesmo projeto e tema aparecem numa linha.${linhas9.length > 8 ? ` A tabela mostra 8 de ${linhas9.length} linhas.` : ''}`);
  resumo.push(`Encaminhamentos: ${cad.length} cadastrados na janela, ${venc.length} vencidos, ${crit.length} críticos.`);

  // ---------- slide 10: visão por gestor ----------
  const caixas = [[155, 156, 158, 160, 162], [166, 167, 169, 171, 173], [177, 178, 180, 182, 184], [188, 189, 191, 193, 195]];
  const usados = new Set<string>();
  for (const [nomeId, vId, mId, cId, rId] of caixas) {
    const g = shapeText(S[10], nomeId).trim();
    usados.add(g);
    const vg = venc.filter((v) => primeiroNome(v.e.gestor) === g);
    setShape(S[10], vId, String(vg.length));
    setShape(S[10], mId, String(vg.filter((v) => v.d > 30).length));
    setShape(S[10], cId, String(cad.filter((e) => primeiroNome(e.gestor) === g).length));
    const linhas: string[] = [];
    const porProj = new Map<string, typeof vg>();
    vg.forEach((v) => { const k = curto(v.e.projeto); porProj.set(k, [...(porProj.get(k) ?? []), v]); });
    for (const [proj, vs] of [...porProj.entries()].sort((a, b) => Math.max(...b[1].map((x) => x.d)) - Math.max(...a[1].map((x) => x.d)))) {
      linhas.push(`${proj}: ${vs.length > 1 ? `${vs.length} vencidos` : resumoPendencia(vs[0].e.nome, 48)} (${pl(Math.max(...vs.map((x) => x.d)), 'dia', 'dias')})`);
    }
    for (const x of [...exp.values()].filter((x) => x.gestor === g).sort((a, b) => soma([...b.fat, ...b.pag].map((p) => p.valor)) - soma([...a.fat, ...a.pag].map((p) => p.valor)))) {
      const vf = soma(x.fat.map((p) => p.valor)), vp = soma(x.pag.map((p) => p.valor));
      if (vf + vp >= 1e6) linhas.push(`${x.curto}: ${[vf ? `faturamento ${mi(vf)}` : '', vp ? `pagamento ${mi(vp)}` : ''].filter(Boolean).join(' e ')}`);
    }
    setShape(S[10], rId, [{ tpl: 0, runs: ['Riscos sob acompanhamento*'] }, ...(linhas.length ? linhas.slice(0, 4) : ['Sem vencidos nem exposição relevante']).map((l) => ({ tpl: 1, runs: [l] }))]);
  }
  const outros = [...new Set(E.map((e) => primeiroNome(e.gestor)).filter((g) => g && !usados.has(g)))]
    .map((g) => `${g} com ${venc.filter((v) => primeiroNome(v.e.gestor) === g).length} vencidos e ${cad.filter((e) => primeiroNome(e.gestor) === g).length} cadastros`);
  setShape(S[10], 197, `Fonte: Monday, Quadro de Encaminhamentos, grupo Monitoramento, consulta em ${consulta}. Contagens pela coluna Gestor; vencidos = abertos com prazo até ${ddmm(isoDe(hoje - 1))} (exclui concluídos, cancelados e despriorizados); cadastros = ${ddmm(P.cadIni)} a ${ddmm(P.cadFim)} pela Data da Reunião.${outros.length ? ` Fora dos quatro quadros: ${lista(outros)}.` : ''} *Riscos pelos encaminhamentos vencidos e pela exposição financeira acima de R$ 1 mi; prioridade e apoio mantidos da reunião anterior, a confirmar na reunião.`);

  if (semGestor.size) avisos.push(`${pl(semGestor.size, 'projeto', 'projetos')} sem gestor no Quadro de Encaminhamentos; mantido o gestor do modelo como vínculo indicativo.`);
  avisos.push('Slides 2 e 11 a 14 não vêm da monday e foram mantidos como no modelo. Prioridade e apoio do slide 10 vêm da reunião anterior, a confirmar.');

  if (P.limparPrioridades) {
    for (const id of [163, 174, 185, 196]) {
      try { setShape(S[10], id, [{ tpl: 0, runs: ['Prioridade: ', 'a definir na reunião'] }, { tpl: 1, runs: ['Apoio / escalonamento: ', 'a definir na reunião'] }]); } catch { /* modelo diferente */ }
    }
    avisos.push('Prioridade e apoio do slide 10 ficaram "a definir na reunião", porque o PPT base é o modelo da Reunião Tática. Use o PPT da última reunião desta coordenação para trazê-los.');
  }
  if (P.coord) {
    const nota = ` Recorte: projetos da coordenação ${P.coord} (coluna Coordenação do Levantamento de Produtos).`;
    for (const [n, id] of [[3, 43], [4, 59], [5, 74], [6, 89], [7, 107], [8, 135], [9, 145], [10, 197]] as const) appendToShape(S[n], id, nota);
    resumo.unshift(`Recorte ${P.coord}: ${pl(new Set(dados.produtos.map((p) => codigo(p.projeto))).size, 'projeto', 'projetos')} no Levantamento de Produtos.`);
  }
  return { bytes: await deck.save(), avisos, resumo };
}

function primeiroPara(doc: any, id: number): string {
  const p = shape(doc, id).getElementsByTagName('a:p')[0];
  return p ? Array.from(p.getElementsByTagName('a:t') as ArrayLike<any>).map((t: any) => t.textContent).join('') : '';
}

/** Tema da pendência, para agrupar registros e sugerir o próximo passo. */
function tema(nome: string): { id: string; rotulo: string; passo: string } {
  const n = nome.toLowerCase();
  const T: [RegExp, string, string, string][] = [
    [/pagamento/, 'pagamento', 'pagamentos pendentes', 'Cobrar o pagamento e registrar o retorno'],
    [/faturament|nota fiscal|empenho|\bnf\b/, 'faturamento', 'faturamento e empenho', 'Destravar o faturamento e registrar a nova previsão'],
    [/matriz de risco|riscos?\b/, 'riscos', 'matriz de riscos', 'Concluir a atualização da matriz na Monday'],
    [/reuni[ãa]o|alinhamento/, 'reuniao', 'reuniões de alinhamento', 'Registrar o resultado da reunião e os próximos passos'],
    [/plano de a[çc][ãa]o|planos de a[çc]/, 'plano', /kpi/.test(n) ? 'plano de ação dos KPIs' : /\bkrs?\b/.test(n) ? 'planos de ação dos KRs' : 'plano de ação', 'Definir a data de entrega do plano de ação'],
    [/cronograma/, 'cronograma', 'cronograma', 'Atualizar o cronograma na Monday'],
    [/indicador|kpi|\bkrs?\b|medi[çc]/, 'indicadores', 'indicadores e medições', 'Atualizar as medições dos indicadores'],
    [/aloca[çc]|equipe/, 'equipe', 'alocações da equipe', 'Atualizar as alocações da equipe na Monday'],
    [/comunica|apresenta|relat[óo]rio|proje[çc]/, 'comunicacao', 'comunicação e relatórios', 'Enviar o material e registrar o envio'],
  ];
  for (const [re, id, rotulo, passo] of T) if (re.test(n)) return { id, rotulo, passo };
  return { id: 'outros', rotulo: 'pendências diversas', passo: 'Definir nova data e registrar o andamento' };
}
