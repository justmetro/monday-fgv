import { useState } from 'react';
import { ChevronDown, Download, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Report } from '@generated/lib/intel';
import { SIT_LABEL, type Sit } from '@generated/lib/intel-stats';
import { interpretReport } from '@generated/server/intel';
import { Block, fdate, InsightList } from './report-parts';
import { SectionView } from './SectionView';
import { Matrix } from './Matrix';
import { factsOf, METHOD, NOTES } from './report-text';
import { cn } from '@lib/utils';

export function ReportView({ report, onRegenerate }: { report: Report; onRegenerate: () => void }) {
  const [summary, setSummary] = useState<string[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const o = report.overall;

  const interpret = async () => {
    setAiBusy(true);
    try { setSummary(await interpretReport({ data: { facts: factsOf(report) } })); }
    catch (e) { console.error(e); toast.error('O resumo interpretativo por IA não está disponível agora. O relatório segue com os números calculados.'); }
    finally { setAiBusy(false); }
  };
  const pdf = async () => {
    setPdfBusy(true);
    try { const { downloadPdf } = await import('./pdf'); await downloadPdf(report, summary); }
    catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF.'); }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm">
          <p><b>{o.label}</b> · data de referência <span className="font-mono">{fdate(report.ref)}</span> (America/Fortaleza) · taxonomia v{report.versao}</p>
          <p className="text-xs text-muted-foreground">Dados importados atualizados entre {fdate(report.dataUpdated.min)} e {fdate(report.dataUpdated.max)} · cadastro dos projetos entre {fdate(report.metaUpdated.min)} e {fdate(report.metaUpdated.max)}
            {report.periodOn && <> · Prazo de Medição {report.cfg.from ? fdate(report.cfg.from) : 'início'} a {report.cfg.to ? fdate(report.cfg.to) : 'fim'}</>} · tipo {report.cfg.tipo === 'all' ? 'todos' : report.cfg.tipo} · mínimos {report.cfg.minMeds} medições / {report.cfg.minProj} projetos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRegenerate} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><RefreshCw className="size-4" aria-hidden />Recalcular</button>
          <button onClick={() => void interpret()} disabled={aiBusy} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm disabled:opacity-50">{aiBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}Resumo interpretativo (IA)</button>
          <button onClick={() => void pdf()} disabled={pdfBusy} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{pdfBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}Baixar PDF</button>
        </div>
      </div>
      {report.cfg.axes.length > 0 && <p className="rounded-md bg-[hsl(var(--warn-soft))] p-3 text-sm text-[hsl(var(--warn))]">Filtro de eixo ativo: a análise geral corresponde à carteira selecionada, não necessariamente à carteira completa.</p>}

      <Block title="Resumo executivo" sub="Números calculados por código; o texto interpretativo (opcional) usa apenas esses números.">
        {summary && <div className="space-y-2 text-sm">{summary.map((p, i) => <p key={i}>{p}</p>)}</div>}
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {(Object.keys(SIT_LABEL) as Sit[]).map((s) => <li key={s} className="flex justify-between gap-2 border-b border-border py-1"><span><b className="font-mono">{s}</b> · {SIT_LABEL[s]}</span><span className="font-mono">{report.sitTotals[s]}</span></li>)}
        </ul>
        <p className="text-xs text-muted-foreground">Medições vinculadas a famílias diferentes aparecem em cada uma, mas uma única vez no total geral.</p>
      </Block>

      <Block title="Análise geral da carteira" sub="Ordenada pela presença em projetos, seguida de indicadores e medições."><SectionView s={o} axis={false} /></Block>

      <Block title="Comparação entre eixos" sub={NOTES.multi}>
        <Matrix report={report} />
        {report.shared.length > 0 && <div><h3 className="mb-1 font-medium">Projetos compartilhados entre eixos</h3><ul className="text-sm">{report.shared.map((s) => <li key={`${s.a}-${s.b}`}>{s.a} × {s.b}: <b className="font-mono">{s.n}</b> projeto(s) em comum</li>)}</ul><p className="text-xs text-muted-foreground">Eixos com projetos em comum não são grupos independentes.</p></div>}
        <div><h3 className="mb-1 font-medium">Padrões entre eixos</h3>{report.comparisons.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum padrão atende aos critérios.</p> : <ul className="space-y-1 text-sm">{report.comparisons.slice(0, 40).map((c, i) => <li key={i}><b className="font-medium">{c.kind}</b> — {c.familia}: <span className="text-muted-foreground">{c.detail}</span></li>)}</ul>}
          <p className="mt-2 text-xs text-muted-foreground">{NOTES.causal}</p></div>
      </Block>

      <Block title="Análise por eixo de atuação" sub={NOTES.inherit}>
        {report.noAxisProjects.length > 0 && <p className="text-xs text-muted-foreground">Sem eixo informado: {report.noAxisProjects.map((p) => `${p.name} (${p.reason})`).join('; ')}.</p>}
        <div className="space-y-2">
          {report.axes.map((a) => (
            <div key={a.axis} className="rounded-md border border-border">
              <button onClick={() => setOpen(open === a.axis ? null : a.axis)} aria-expanded={open === a.axis} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left">
                <span className="font-medium">{a.label} <span className="text-sm font-normal text-muted-foreground">· {a.sec.projects.length} projetos · {a.sec.indicators.length} indicadores</span></span>
                <ChevronDown className={cn('size-4 transition-transform', open === a.axis && 'rotate-180')} aria-hidden />
              </button>
              {open === a.axis && <div className="border-t border-border p-3"><SectionView s={a.sec} axis /></div>}
            </div>
          ))}
        </div>
      </Block>

      <Block title="Tendências do mesmo indicador" sub="Medições concluídas com valor numérico e datas válidas (mín. 3), usando intervalos reais entre datas e a polaridade. Crescimento não é presumido como melhora.">
        {report.trends.length === 0 ? <p className="text-sm text-muted-foreground">Sem séries comparáveis.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="p-1">Indicador</th><th className="p-1">Projeto</th><th className="p-1 text-right">Pontos</th><th className="p-1 text-right">Dias</th><th className="p-1 text-right">Primeiro → último</th><th className="p-1">Leitura</th></tr></thead>
            <tbody className="divide-y divide-border">{report.trends.slice(0, 40).map((t, i) => <tr key={i}><td className="p-1">{t.ind}</td><td className="p-1 text-muted-foreground">{t.proj}</td><td className="p-1 text-right font-mono">{t.n}</td><td className="p-1 text-right font-mono">{t.dias}</td><td className="p-1 text-right font-mono">{t.primeiro.toLocaleString('pt-BR')} → {t.ultimo.toLocaleString('pt-BR')}</td><td className="p-1">{t.leitura}</td></tr>)}</tbody></table></div>
        )}
      </Block>

      <Block title="Insights gerais"><InsightList items={o.insights} /></Block>

      <Block title="Metodologia e limitações">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{METHOD.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </Block>

      <Block title={`Apêndice — ${report.appendix.length} indicadores`}>
        <div className="max-h-[50vh] overflow-auto rounded-md border border-border"><table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 bg-muted text-left text-[11px] uppercase text-muted-foreground"><tr><th className="p-2">Indicador</th><th className="p-2">Projeto</th><th className="p-2">Eixos</th><th className="p-2">Tema › Subtema › Família</th><th className="p-2">Classificação</th><th className="p-2">Resultado consolidado (original)</th></tr></thead>
          <tbody className="divide-y divide-border">{report.appendix.map((r) => <tr key={r.key}><td className="p-2">{r.ind}<span className="block text-xs text-muted-foreground">{r.tipo ?? '—'}</span></td><td className="p-2">{r.proj}</td><td className="p-2">{r.eixos.join(', ') || '—'}</td><td className="p-2">{r.tema} › {r.subtema} › {r.familia}</td><td className="p-2 text-xs">{r.origem ?? '—'}{r.revisado ? ' · revisada' : ''}</td><td className="p-2 font-mono">{r.resultadoConsolidado ?? '—'}{r.unidade ? ` ${r.unidade}` : ''}</td></tr>)}</tbody></table></div>
      </Block>
    </div>
  );
}
