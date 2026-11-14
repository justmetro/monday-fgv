import { useState } from 'react';
import { FileUp, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { applyBaseRows, previewBaseRows } from '@generated/server/baseManagement';
import { parseBaseFile, type BaseFileParse } from '@generated/lib/baseRows';
import { readCsvMatrix } from '@generated/lib/panelCsv';
import { readXlsxFirstSheet } from '@generated/lib/xlsxReader';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;
interface Props { clientClaim: Claim; onSaved: () => void }

/** Reescrita por arquivo: atualiza a Base por e-mail + semana, sem duplicar; prévia antes de gravar. */
export function BaseRewriteFile({ clientClaim, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<BaseFileParse | null>(null);
  const [counts, setCounts] = useState<{ created: number; updated: number; unchanged: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reset = () => { setParsed(null); setCounts(null); setMsg(null); };

  const makePreview = async () => {
    if (!file) return;
    setBusy(true);
    reset();
    try {
      const matrix = file.name.toLowerCase().endsWith('.xlsx') ? await readXlsxFirstSheet(file) : await readCsvMatrix(file);
      const p = parseBaseFile(matrix);
      if (!p.ok) { setMsg({ ok: false, text: p.message }); return; }
      setParsed(p.data);
      const res = await previewBaseRows({ data: { rows: p.data.rows.map((r) => ({ ...r, group: r.group ?? '' })), clientClaim } });
      setCounts(res);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Não foi possível ler o arquivo.' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await applyBaseRows({ data: { rows: parsed.rows.map((r) => ({ ...r, group: r.group ?? '' })), clientClaim } });
      setMsg({ ok: true, text: `Base gravada: ${res.created} criadas · ${res.updated} atualizadas · ${res.unchanged} iguais · ${parsed.ignored.length} ignoradas.` });
      setParsed(null);
      setCounts(null);
      setFile(null);
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Não foi possível gravar a Base.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Use a mesma estrutura da exportação (Semana, Nome, E-mail, … Segunda a Domingo com Sim/Não). Linha existente (e-mail + semana) é atualizada; inexistente é criada. Check marcado nunca é removido por arquivo.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <label className="h-11 px-4 rounded-xl border border-dashed border-border bg-muted/30 text-xs text-foreground inline-flex items-center gap-2 cursor-pointer min-w-0">
          <FileUp className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{file ? file.name : 'Escolher CSV ou XLSX'}</span>
          <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => void makePreview()} disabled={!file || busy} className="h-11 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy && !parsed && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Gerar prévia
        </button>
      </div>

      {parsed && counts && (
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[['Criadas', counts.created], ['Atualizadas', counts.updated], ['Iguais (sem mudança)', counts.unchanged], ['Ignoradas', parsed.ignored.length]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{l}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{v}</p>
              </div>
            ))}
          </div>
          {parsed.ignored.length > 0 && (
            <ul className="text-[11px] text-muted-foreground max-h-28 overflow-y-auto">
              {parsed.ignored.slice(0, 50).map((i) => <li key={`${i.row}-${i.reason}`}>Linha {i.row}: {i.reason}</li>)}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} disabled={busy} className="h-10 px-4 rounded-xl border border-border text-xs hover:bg-muted">Descartar</button>
            <button type="button" onClick={() => void save()} disabled={busy || counts.created + counts.updated === 0} className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar e gravar na Base
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-xs rounded-xl p-3 flex items-start gap-2 break-words ${msg.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {msg.text}
        </p>
      )}
    </div>
  );
}
