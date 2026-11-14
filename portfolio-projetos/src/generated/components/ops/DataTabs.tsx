import { useMemo, useState, type ReactNode } from 'react';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { splitList, textMatch, uniq } from '@generated/lib/ops';
import { DataTable } from './DataTable';
import { productColumns, riskColumns, scheduleColumns, SubitemList } from './columns';
import { Sel } from './GlobalFilters';

const Row = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
const FLAG_OPTS = ['Com sinalização', 'Sem sinalização'];

export function ScheduleData({ m, s, q }: { m: OpsModel; s: OpsScope; q: string }) {
  const [f, setF] = useState({ status: '', resp: '', frente: '', saude: '', flag: '' });
  const opts = useMemo(() => ({
    status: uniq(s.schedule.map((x) => x.status)), resp: uniq(s.schedule.flatMap((x) => x.responsaveis)),
    frente: uniq(s.schedule.flatMap((x) => splitList(x.frentes))), saude: uniq(s.schedule.map((x) => x.saude)),
  }), [s]);
  const rows = s.schedule.filter((x) => {
    const subs = m.subsOf.get(`${x.projectBoardId}:${x.itemId}`) ?? [];
    const flagged = !!(x.flagAtrasada || x.flagSemCronograma || x.flagSemResponsavel);
    return (!f.status || x.status === f.status) && (!f.resp || x.responsaveis.includes(f.resp) || subs.some((u) => u.responsaveis.includes(f.resp)))
      && (!f.frente || splitList(x.frentes).includes(f.frente)) && (!f.saude || x.saude === f.saude)
      && (!f.flag || (f.flag === FLAG_OPTS[0]) === flagged)
      && (textMatch(q, x.name, x.frentes, x.responsaveis, x.status, x.produtoText) || subs.some((u) => textMatch(q, u.name, u.responsaveis)));
  });
  const cols = useMemo(() => scheduleColumns(m), [m]);
  return (
    <div className="space-y-3">
      <Row>
        <Sel label="Status" value={f.status} options={opts.status} onChange={(v) => setF({ ...f, status: v })} />
        <Sel label="Responsável" value={f.resp} options={opts.resp} onChange={(v) => setF({ ...f, resp: v })} />
        <Sel label="Frente" value={f.frente} options={opts.frente} onChange={(v) => setF({ ...f, frente: v })} all="Todas" />
        <Sel label="Saúde" value={f.saude} options={opts.saude} onChange={(v) => setF({ ...f, saude: v })} all="Todas" />
      </Row>
      <DataTable cols={cols} rows={rows} rowKey={(r) => `${r.projectBoardId}:${r.itemId}`} fileName="cronograma" empty="Nenhuma atividade no recorte. Configure o grupo Cronograma na Importação, se ainda não o fez."
        expand={(r) => { const subs = m.subsOf.get(`${r.projectBoardId}:${r.itemId}`); return subs?.length ? <SubitemList m={m} rows={subs} /> : null; }} />
    </div>
  );
}

export function ProductData({ m, s, q }: { m: OpsModel; s: OpsScope; q: string }) {
  const [f, setF] = useState({ status: '', pay: '', flag: '' });
  const opts = useMemo(() => ({ status: uniq(s.products.map((x) => x.status)), pay: uniq(s.products.map((x) => x.statusPagamento)) }), [s]);
  const rows = s.products.filter((x) => {
    const flagged = !!(x.flagEntregaAtrasada || x.flagSemEntregaPlanejada || x.flagEntregueSemFaturamento || x.flagPagamentoPendente);
    return (!f.status || x.status === f.status) && (!f.pay || x.statusPagamento === f.pay) && (!f.flag || (f.flag === FLAG_OPTS[0]) === flagged) && textMatch(q, x.name, x.status, x.statusPagamento, x.linkText);
  });
  const cols = useMemo(() => productColumns(m), [m]);
  return (
    <div className="space-y-3">
      <Row>
        <Sel label="Status do produto" value={f.status} options={opts.status} onChange={(v) => setF({ ...f, status: v })} />
        <Sel label="Status do pagamento" value={f.pay} options={opts.pay} onChange={(v) => setF({ ...f, pay: v })} />
        <Sel label="Sinalizações" value={f.flag} options={FLAG_OPTS} onChange={(v) => setF({ ...f, flag: v })} />
      </Row>
      <DataTable cols={cols} rows={rows} rowKey={(r) => `${r.projectBoardId}:${r.itemId}`} fileName="produtos" empty="Nenhum produto no recorte. Configure o grupo Produtos na Importação, se ainda não o fez." />
    </div>
  );
}

export function RiskData({ m, s, q }: { m: OpsModel; s: OpsScope; q: string }) {
  const [f, setF] = useState({ nivel: '', cat: '', tema: '', resp: '' });
  const opts = useMemo(() => ({ nivel: uniq(s.risks.map((x) => x.nivel)), cat: uniq(s.risks.map((x) => x.categoria)), tema: uniq(s.risks.map((x) => x.tema)), resp: uniq(s.risks.flatMap((x) => x.responsaveis)) }), [s]);
  const rows = s.risks.filter((x) => (!f.nivel || x.nivel === f.nivel) && (!f.cat || x.categoria === f.cat) && (!f.tema || x.tema === f.tema) && (!f.resp || x.responsaveis.includes(f.resp))
    && textMatch(q, x.name, x.tema, x.categoria, x.causa, x.efeito, x.resposta, x.responsaveis));
  const cols = useMemo(() => riskColumns(m), [m]);
  return (
    <div className="space-y-3">
      <Row>
        <Sel label="Nível" value={f.nivel} options={opts.nivel} onChange={(v) => setF({ ...f, nivel: v })} />
        <Sel label="Categoria" value={f.cat} options={opts.cat} onChange={(v) => setF({ ...f, cat: v })} all="Todas" />
        <Sel label="Tema" value={f.tema} options={opts.tema} onChange={(v) => setF({ ...f, tema: v })} />
        <Sel label="Responsável" value={f.resp} options={opts.resp} onChange={(v) => setF({ ...f, resp: v })} />
      </Row>
      <DataTable cols={cols} rows={rows} rowKey={(r) => `${r.projectBoardId}:${r.itemId}`} fileName="riscos" empty="Nenhum risco no recorte. Configure o grupo Riscos na Importação, se ainda não o fez." />
    </div>
  );
}
