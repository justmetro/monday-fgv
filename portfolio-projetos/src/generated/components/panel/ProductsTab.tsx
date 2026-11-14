import type { ProductDoc } from '@generated/models';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { fmtBRL } from '@generated/lib/money';
import { GroupedBars, KpiRow } from './ChartCard';
import { StackedPctCard, type Bucket } from './StackedPctCard';

const nrm = (s: string | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const GREY = 'hsl(var(--muted-foreground) / 0.4)';
const PROD_B: Bucket[] = [
  { key: 'done', label: 'Concluído', color: 'hsl(var(--ok))' }, { key: 'prog', label: 'Em progresso', color: 'hsl(var(--warn))' },
  { key: 'idle', label: 'Não iniciado / Despriorizado', color: GREY }, { key: 'stop', label: 'Parado', color: 'hsl(var(--destructive))' },
];
const PAY_B: Bucket[] = [
  { key: 'paid', label: 'Pago', color: 'hsl(var(--ok))' }, { key: 'billed', label: 'Faturado', color: 'hsl(var(--ok) / 0.5)' },
  { key: 'committed', label: 'Empenhado', color: 'hsl(var(--warn))' }, { key: 'none', label: 'Não iniciado / Não há', color: GREY },
];
function prodBucket(x: ProductDoc) {
  const s = nrm(x.status);
  if (/conclu|entregue|finaliz/.test(s)) return 'done';
  if (/parad|cancel/.test(s)) return 'stop';
  if (/progress|andamento|execu/.test(s)) return 'prog';
  return 'idle';
}
function payBucket(x: ProductDoc) {
  const s = nrm(x.statusPagamento);
  if (/^pago|\bpago\b/.test(s)) return 'paid';
  if (/fatur/.test(s)) return 'billed';
  if (/empenh/.test(s)) return 'committed';
  return 'none';
}
import type { OpsDrill } from './OpsDrillSheet';
import { ProductRiskPanel } from './ProductRiskPanel';
import { Panel } from '../ui-bits';

const month = (d: string | null) => (d && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);
const mLabel = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
const sum = (l: ProductDoc[], f: (p: ProductDoc) => number | null) => l.reduce((a, p) => a + (f(p) ?? 0), 0);

/** Aba Produtos do Painel gerencial. */
export function ProductsTab({ m, s, onDrill }: { m: OpsModel; s: OpsScope; onDrill: (d: OpsDrill) => void }) {
  const all = s.products;
  const delivered = all.filter(m.isDelivered);
  const payPend = all.filter((x) => x.flagPagamentoPendente);
  // Previstos: mês do fim de "Planejado Início - Entrega" (sem ela, Entrega Planejada).
  // Entregues: produtos com status concluído, no mesmo mês de referência. Janela: 6 meses antes a 5 depois de hoje.
  const dueOf = (x: ProductDoc) => x.planEntrega ?? x.entregaPlanejada;
  const concluded = all.filter((x) => prodBucket(x) === 'done');
  const now = new Date(`${m.today.slice(0, 7)}-01T00:00:00`);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const timeline = months.map((ym) => ({ name: mLabel(ym), ym, Previstos: all.filter((x) => month(dueOf(x)) === ym).length, Entregues: concluded.filter((x) => month(dueOf(x)) === ym).length }));
  const pName = (x: ProductDoc) => m.projectBy.get(x.projectBoardId)?.name ?? x.projectBoardId;

  if (all.length === 0) return <Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto no recorte. Configure o grupo Produtos dos projetos na tela de Importação.</p></Panel>;
  return (
    <div className="space-y-5">
      <KpiRow items={[
        { label: 'Produtos previstos', value: String(all.length), onClick: () => onDrill({ title: 'Produtos previstos', products: all }) },
        { label: 'Entregues', value: String(delivered.length), tone: 'ok', onClick: () => onDrill({ title: 'Produtos entregues', products: delivered }) },
        { label: 'Valor total', value: fmtBRL(sum(all, (p) => p.valor)), onClick: () => onDrill({ title: 'Produtos (valor)', products: all }) },
        { label: 'Pagamento pendente', value: String(payPend.length), tone: payPend.length ? 'warn' : undefined, hint: 'entregues e não pagos', onClick: () => onDrill({ title: 'Produtos com pagamento pendente', products: payPend }) },
      ]} />
      <ProductRiskPanel m={m} s={s} />
      <GroupedBars title="Previstos × entregues por mês" data={timeline} series={[{ key: 'Previstos', label: 'Previstos (fim do Planejado Início - Entrega)' }, { key: 'Entregues', label: 'Entregues (status concluído)' }]}
        onPick={(row, key) => { const ym = String(row.ym); onDrill({ title: `${key} em ${row.name}`, products: (key === 'Previstos' ? all : concluded).filter((x) => month(dueOf(x)) === ym) }); }} />
      <div className="grid gap-4 lg:grid-cols-2">
        <StackedPctCard title="Status do produto por projeto (100%)" buckets={PROD_B} list={all} groupOf={pName} bucketOf={prodBucket}
          onPick={(g, b, items) => onDrill({ title: `${g} · ${b.label}`, products: items })} />
        <StackedPctCard title="Status do pagamento por projeto (100%)" buckets={PAY_B} list={all} groupOf={pName} bucketOf={payBucket}
          onPick={(g, b, items) => onDrill({ title: `${g} · ${b.label}`, products: items })} />
      </div>
    </div>
  );
}
