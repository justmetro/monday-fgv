import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { board } from '@generated/lib/data';
import { clean, canon } from '@generated/lib/normalize';

// Roboto (bundled) supports PT-BR accents; text stays selectable.
pdfMake.vfs = pdfFonts?.pdfMake?.vfs ?? pdfFonts?.vfs ?? pdfFonts;

const BLUE = '#1F6FBF', GREEN = '#0E9F6E', ORANGE = '#E8590C', GRAY = '#6B7280', LINE = '#C9D3DF';
const COLS = ['email', 'telefone', 'cidadeDeResidncia', 'ufDeResidncia', 'vnculo', 'tempoDeDgpeMeses', 'modalidadeDeAtuaoAtual', 'salrioAtualR',
  'dataDoGatilho', 'dataDeDisponibilidade', 'gatilhoDaRealocao', 'interesseEmMudarDeCidade', 'ufsDeInteresse', 'colaboradoraDestaque', 'statusDoPerfil',
  'linkedin', 'currculoLattes', 'linkCardDePerfilFc10', 'projetoDoaSolicitante1109', 'projeto', 'projetoReaDeAtuao', 'gerenteDeOrigem', 'papelDeOrigem',
  'trilha', 'senioridadeAtual', 'perfilReasDeAtuao', 'competnciasEHabilidades', 'principaisInteresses', 'principaisAtividadesEntregas', 'pontosFortes',
  'pontosDeMelhoria', 'observaesPerfil'];

const str = (v) => { const c = clean(v); if (c == null) return null; if (Array.isArray(c)) { const a = c.filter((x) => x && x !== '-'); return a.length ? a.join(', ') : null; } const s = String(c).trim(); return s && s !== '-' ? s : null; };
const lab = (v) => { const s = str(v); return s ? (canon(s) ?? s) : null; };
const dt = (v) => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); };
const brl = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? null : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const link = (l) => (l?.url ? { text: l.label || l.url, link: l.url, color: BLUE, decoration: 'underline' } : null);

const tableLayout = { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => LINE, vLineColor: () => LINE, paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 6, paddingRight: () => 6 };
const L = (t) => ({ text: t, bold: true, fillColor: '#F3F6FA' });

// 2-column pairs table (label/value/label/value); long values take a full row.
function pairsTable(pairs) {
  const body = []; let row = [];
  pairs.forEach(([k, v]) => {
    const long = typeof v === 'string' && v.length > 45;
    if (long) { if (row.length) { body.push([...row, '', '']); row = []; } body.push([L(k), { text: v, colSpan: 3 }, '', '']); return; }
    row.push(L(k), v);
    if (row.length === 4) { body.push(row); row = []; }
  });
  if (row.length) body.push([...row, { text: '', colSpan: 2 }, '']);
  return { table: { widths: ['auto', '*', 'auto', '*'], body, dontBreakRows: true }, layout: tableLayout, margin: [0, 0, 0, 4] };
}
const listTable = (pairs) => ({ table: { widths: [150, '*'], body: pairs.map(([k, v]) => [L(k), v]), dontBreakRows: true }, layout: tableLayout });
const para = (t) => ({ text: t, margin: [0, 0, 0, 6], lineHeight: 1.25 });
const filled = (pairs) => pairs.filter(([, v]) => v != null && v !== '');

function build(p) {
  const loc = [str(p.cidadeDeResidncia), str(p.ufDeResidncia) && `(${str(p.ufDeResidncia)})`].filter(Boolean).join(' ') || null;
  const tempo = str(p.tempoDeDgpeMeses);
  const sections = [];
  const geral = filled([
    ['E-mail', p.email?.email ?? null], ['Telefone', p.telefone?.phone ?? null], ['Localização', loc], ['Vínculo', lab(p.vnculo)],
    ['Tempo de DGPE', tempo ? `${tempo} meses` : null], ['Modalidade Atual', lab(p.modalidadeDeAtuaoAtual)], ['Salário Atual', brl(p.salrioAtualR)],
    ['Data do Gatilho', dt(p.dataDoGatilho)], ['Data de Disponibilidade', dt(p.dataDeDisponibilidade)], ['Gatilho da Realocação', lab(p.gatilhoDaRealocao)],
    ['Mudar de Cidade?', lab(p.interesseEmMudarDeCidade)], ['UFs de Interesse', str(p.ufsDeInteresse)], ['Colaborador(a) Destaque?', lab(p.colaboradoraDestaque)],
    ['Status do Perfil', lab(p.statusDoPerfil)],
  ]);
  const links = filled([['LinkedIn', link(p.linkedin)], ['Currículo Lattes', link(p.currculoLattes)], ['Card de Perfil (FC.10)', link(p.linkCardDePerfilFc10)]]);
  if (geral.length || links.length) sections.push({ t: 'Informações Gerais e Contato', c: [geral.length && pairsTable(geral), links.length && listTable(links)].filter(Boolean) });
  const orig = filled([['Projeto de Origem', str(p.projetoDoaSolicitante1109) ?? str(p.projeto) ?? str(p.projetoReaDeAtuao)], ['Gerente de Origem', str(p.gerenteDeOrigem)], ['Papel de Origem', str(p.papelDeOrigem)], ['Trilha', lab(p.trilha)]]);
  if (orig.length) sections.push({ t: 'Contexto de Origem', c: [listTable(orig)] });
  const comp = filled([['Áreas de Atuação', str(p.perfilReasDeAtuao)], ['Competências & Habilidades', str(p.competnciasEHabilidades)], ['Principais Interesses', str(p.principaisInteresses)]]);
  if (comp.length) sections.push({ t: 'Perfil de Atuação, Competências e Interesses', c: [listTable(comp)] });
  if (str(p.principaisAtividadesEntregas)) sections.push({ t: 'Principais Atividades e Entregas', c: [para(str(p.principaisAtividadesEntregas))] });
  const av = [];
  if (str(p.pontosFortes)) av.push({ text: 'Pontos Fortes', bold: true, color: GREEN, margin: [0, 0, 0, 3] }, para(str(p.pontosFortes)));
  if (str(p.pontosDeMelhoria)) av.push({ text: 'Pontos de Melhoria / Oportunidades de Desenvolvimento', bold: true, color: ORANGE, margin: [0, 2, 0, 3] }, para(str(p.pontosDeMelhoria)));
  if (av.length) sections.push({ t: 'Avaliação de Desempenho e Desenvolvimento', c: av });
  if (str(p.observaesPerfil)) sections.push({ t: 'Observações e Recomendações para Realocação', c: [para(str(p.observaesPerfil))] });

  const sub = [str(p.papelDeOrigem), lab(p.senioridadeAtual) && `Senioridade: ${lab(p.senioridadeAtual)}`, lab(p.statusDoPerfil) && `Status: ${lab(p.statusDoPerfil)}`].filter(Boolean).join(' | ');
  const today = new Date().toLocaleDateString('pt-BR');
  return {
    pageSize: 'A4', pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1E1E1E' },
    info: { title: `Perfil - ${p.name}` },
    footer: (cur, total) => ({ columns: [{ text: `Gerado em ${today} pelo app Gestão de RPC`, color: GRAY, fontSize: 7.5 }, { text: `Página ${cur} de ${total}`, alignment: 'right', color: GRAY, fontSize: 7.5 }], margin: [40, 18, 40, 0] }),
    content: [
      { text: 'PERFIL PROFISSIONAL PARA REALOCAÇÃO', color: BLUE, bold: true, fontSize: 11, characterSpacing: 0.5 },
      { text: p.name, bold: true, fontSize: 20, margin: [0, 6, 0, 2] },
      sub ? { text: sub, color: GRAY, fontSize: 10 } : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: BLUE }], margin: [0, 8, 0, 12] },
      ...sections.flatMap((s, i) => [{ text: `${i + 1}. ${s.t}`, bold: true, fontSize: 12, margin: [0, i ? 12 : 0, 0, 6], headlineLevel: 1 }, ...s.c]),
    ].filter(Boolean),
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
  };
}

export async function downloadPerfilPdf(id) {
  const item = await board.item(String(id)).withColumns(COLS).execute();
  if (!item) throw new Error('Perfil não encontrado');
  const safe = String(item.name ?? 'perfil').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  await new Promise((resolve, reject) => {
    try { pdfMake.createPdf(build(item)).download(`Perfil - ${safe}.pdf`, resolve); } catch (e) { reject(e); }
  });
}
