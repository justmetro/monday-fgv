import { INDICATOR_FIELDS, MEASUREMENT_FIELDS, type ProjectConfig } from '@generated/lib/fields';
import { fmtDate, fmtField } from '@generated/lib/format';
import type { Preview } from './ImportWizard';
import { LabelPicker } from './MappingStep';

export function PreviewStep({ preview: p, cfg, setCfg, medLabels, confirm }: {
  preview: Preview; cfg: ProjectConfig; setCfg: (c: ProjectConfig) => void; medLabels: string[]; confirm: boolean;
}) {
  const found = [...INDICATOR_FIELDS.filter((d) => cfg.indicatorCols[d.key]).map((d) => `Indicador · ${d.label}`), ...MEASUREMENT_FIELDS.filter((d) => cfg.measurementCols[d.key]).map((d) => `Medição · ${d.label}`)];
  const missing = [...INDICATOR_FIELDS.filter((d) => !cfg.indicatorCols[d.key]).map((d) => `Indicador · ${d.label}`), ...MEASUREMENT_FIELDS.filter((d) => !cfg.measurementCols[d.key]).map((d) => `Medição · ${d.label}${d.optional ? ' (opcional)' : ''}`)];
  const s = cfg.status;
  const set = (k: keyof ProjectConfig['status'], v: string[]) => setCfg({ ...cfg, status: { ...s, [k]: v } });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
        {[['Projeto', p.projectName], ['Área de trabalho', p.workspaceName], ['Indicadores', String(p.indicatorCount)], ['Medições', String(p.measurementCount)]].map(([l, v]) => (
          <div key={l} className="min-w-0 bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p><p className="mt-1 break-words text-sm font-medium">{v}</p></div>
        ))}
      </div>
      {confirm ? (
        <div className="rounded-md bg-muted p-4 text-sm">
          Serão salvos <b>{p.indicatorCount}</b> indicadores e <b>{p.measurementCount}</b> medições de <b>{p.projectName}</b>. Registros existentes serão atualizados pelos IDs, sem duplicar. A configuração de grupos, colunas e rótulos será guardada para as próximas atualizações. Nenhum dado será escrito no quadro de origem.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="mb-1 text-sm font-medium">Campos encontrados ({found.length})</p><ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">{found.map((f) => <li key={f}>✓ {f}</li>)}</ul></div>
            <div><p className="mb-1 text-sm font-medium">Campos ausentes ({missing.length})</p>
              <ul className="max-h-40 overflow-y-auto text-xs text-[hsl(var(--warn))]">{missing.length ? missing.map((f) => <li key={f}>• {f}</li>) : <li className="text-muted-foreground">Nenhum</li>}</ul>
              {p.unavailableFields.length > 0 && <p className="mt-2 text-xs text-[hsl(var(--warn))]">Indisponíveis na leitura (campos calculados): {p.unavailableFields.join(', ')}</p>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Medições sem vínculo resolvido ({p.unresolved.length})</p>
            {p.unresolved.length === 0 ? <p className="text-xs text-muted-foreground">Todas as medições apontam para indicadores do grupo selecionado.</p> : (
              <ul className="max-h-36 overflow-y-auto rounded-md border border-border text-xs">{p.unresolved.map((u) => <li key={u.itemId} className="flex justify-between gap-2 border-b border-border/60 px-2 py-1.5 last:border-0"><span className="truncate">{u.name}</span><span className="shrink-0 text-[hsl(var(--warn))]">{u.motivo}</span></li>)}</ul>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="mb-1 text-sm font-medium">Exemplos de indicadores</p>
              <ul className="space-y-1 text-xs">{p.sampleIndicators.map((i) => <li key={i.itemId} className="rounded border border-border p-2"><b>{i.name}</b><br /><span className="text-muted-foreground">{i.tipo ?? 'Sem tipo'} · Meta {fmtField(i, 'meta', i.meta)} · {i.medicaoIds.length} medições conectadas</span></li>)}</ul></div>
            <div><p className="mb-1 text-sm font-medium">Exemplos de medições</p>
              <ul className="space-y-1 text-xs">{p.sampleMeasurements.map((m) => <li key={m.itemId} className="rounded border border-border p-2"><b>{m.name}</b><br /><span className="text-muted-foreground">Prazo {fmtDate(m.prazo)} · {m.statusMedicao ?? 'sem status'} · Meta {fmtField(m, 'meta', m.meta)} · Apurado {fmtField(m, 'valorApurado', m.valorApurado)} · Resultado {fmtField(m, 'resultado', m.resultado)}</span></li>)}</ul></div>
          </div>
          <div className="space-y-4 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Classificação dos rótulos de status</p>
            <div className="grid gap-4 md:grid-cols-2">
              <LabelPicker title="Status Medição → Concluída" hint="Contam como medições concluídas." labels={medLabels} value={s.concluded} onChange={(v) => set('concluded', v)} />
              <LabelPicker title="Status Medição → Cancelada / não aplicável" hint="Não contam como atrasadas." labels={medLabels} value={s.excluded} onChange={(v) => set('excluded', v)} />
              <LabelPicker title="Status da Meta → Alcançada" hint="Numerador do percentual de meta alcançada." labels={p.statusMetaValues} value={s.reached} onChange={(v) => set('reached', v)} />
              <LabelPicker title="Status da Meta → Não alcançada" hint="Demais rótulos ficam fora do denominador." labels={p.statusMetaValues} value={s.notReached} onChange={(v) => set('notReached', v)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
