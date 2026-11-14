import { BOARD_IND, fmtDate, fmtNum, ymd, todayYmd } from '@generated/lib';

const CLOSED = ['Concluído', 'Retroativo'];

/** data issues of the MEDIÇÃO view (01.02) and of the indicators shown */
export function qualityIssues(raw, ind, year) {
  const hoje = todayYmd();
  const metaInd = Object.fromEntries(ind.map((i) => [i.code, i.metaInd]));
  const codes = new Set(ind.map((i) => i.code));
  const inYear = (r) => codes.has(r.code) && (!r.period || r.period.year === year);
  const out = [];
  const add = (tipo, r, detalhe) => out.push({ key: `${tipo}-${r.id}`, tipo, nome: r.name, code: r.code, periodo: r.period?.label, detalhe, board: BOARD_IND, view: 'med', id: r.id });
  raw.filter(inYear).forEach((r) => {
    if (r.status === 'Cancelado' || r.status === 'Não Iniciado') return;
    const fechada = CLOSED.includes(r.status);
    if (fechada && r.d == null) add('Medição fechada com Total Período vazio', r, `Status ${r.status}`);
    if (fechada && r.n != null && r.d != null && r.n > r.d) add('Atingido Período maior que Total Período', r, `Atingido ${fmtNum(r.n)} · Total ${fmtNum(r.d)}`);
    if (!fechada && r.prazo && hoje > ymd(r.prazo) && r.d == null) add('Prazo vencido sem Atingido / Total Período', r, `Prazo ${fmtDate(r.prazo)}`);
    if (r.status === 'Em Progresso' && r.periodEnd && hoje > ymd(r.periodEnd)) add('Em Progresso com período encerrado', r, `Período até ${fmtDate(r.periodEnd)}`);
    const mi = r.code && metaInd[r.code];
    if (r.meta != null && mi != null && r.meta !== mi) add('Meta diferente da meta do indicador', r, `Medição ${r.meta}% · indicador ${mi}%`);
  });
  ind.forEach((i) => {
    const falta = [i.semCodigo && 'Código', !i.obj && 'Objetivo', i.metaInd == null && 'Meta'].filter(Boolean);
    if (falta.length) out.push({ key: `incompleto-${i.id}`, tipo: 'Indicador exibido sem Código/Objetivo/Meta', nome: i.curto, code: i.semCodigo ? null : i.code, periodo: null, detalhe: `Falta: ${falta.join(', ')}`, board: BOARD_IND, view: 'ind', id: i.id });
  });
  ind.forEach((i) => {
    if (i.fonte?.base || !i.meds.some((m) => m.period.year === year)) return;
    out.push({ key: `base-${i.id}`, tipo: 'Indicador sem Base de dados cadastrada', nome: i.curto, code: i.code, periodo: null, detalhe: 'Coluna Base de dados vazia', board: BOARD_IND, view: 'ind', id: i.id });
  });
  return out;
}
