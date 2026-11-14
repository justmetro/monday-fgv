import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { importSnapshotFromFiles } from '@generated/server/storage';
import type { ImportReport } from '@generated/models';
import { ENGAGEMENT_COLUMNS, PROJECT_COLUMNS, parseBoardFile } from '@generated/lib/boardFileParser';
import { useUserSession } from '@generated/hooks/useUserSession';

interface Props {
  lastReport: ImportReport | null;
  onImported: () => void;
}

function FilePick({ id, label, hint, file, onPick }: { id: string; label: string; hint: string; file: File | null; onPick: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">{label}</label>
      <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      <input
        ref={ref}
        id={id}
        type="file"
        accept=".csv,.xlsx"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <div className="mt-3 flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="h-10 px-3 rounded border border-border bg-card text-xs text-foreground hover:bg-muted inline-flex items-center gap-1.5 shrink-0"
        >
          <Upload className="w-3.5 h-3.5" /> Escolher arquivo
        </button>
        {file ? (
          <span className="flex items-center gap-1.5 min-w-0 text-xs text-foreground">
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate" title={file.name}>{file.name}</span>
            <button type="button" aria-label="Remover arquivo" onClick={() => onPick(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Nenhum arquivo</span>
        )}
      </div>
    </div>
  );
}

function ReportBlock({ report }: { report: ImportReport }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-xs">
      {[
        { title: 'Análise de Engajamento', file: report.engagementFile, read: report.rowsRead, saved: report.rowsSaved, unit: 'linhas', discards: report.rowsDiscarded },
        { title: 'Histórico de Projetos', file: report.projectsFile, read: report.projectsRead, saved: report.projectsSaved, unit: 'projetos', discards: report.projectsDiscarded },
      ].map((b) => (
        <div key={b.title} className="rounded-lg border border-border p-3 space-y-1.5 min-w-0">
          <p className="font-medium text-foreground">{b.title}</p>
          <p className="text-muted-foreground truncate" title={b.file}>{b.file}</p>
          <p className="text-foreground">
            {b.read} {b.unit} lidas · <strong>{b.saved} salvas</strong> · {b.read - b.saved} descartadas
          </p>
          {b.unit === 'projetos' && report.projectsActive !== undefined && (
            <p className="text-muted-foreground">Dos salvos, <strong className="text-foreground">{report.projectsActive}</strong> são ativos (Em planejamento, Em execução ou Em encerramento).</p>
          )}
          {b.discards.length > 0 && (
            <ul className="space-y-0.5 text-muted-foreground">
              {b.discards.map((d) => (
                <li key={d.reason}>• {d.reason}: {d.count}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function ImportUploadPanel({ lastReport, onImported }: Props) {
  const { session } = useUserSession();
  const [engFile, setEngFile] = useState<File | null>(null);
  const [projFile, setProjFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<{ file: string; cols: string[] }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const run = async () => {
    if (!engFile || !projFile) return;
    setBusy(true);
    setError(null);
    setMissing([]);
    setReport(null);
    try {
      const [eng, proj] = await Promise.all([parseBoardFile(engFile, ENGAGEMENT_COLUMNS), parseBoardFile(projFile, PROJECT_COLUMNS)]);
      const miss = [
        ...(eng.missing.length ? [{ file: `Análise de Engajamento (${engFile.name})`, cols: eng.missing }] : []),
        ...(proj.missing.length ? [{ file: `Histórico de Projetos (${projFile.name})`, cols: proj.missing }] : []),
      ];
      if (miss.length > 0) {
        setMissing(miss);
        return; // nada é salvo
      }
      const res = await importSnapshotFromFiles({
        data: {
          engagementFile: engFile.name,
          projectsFile: projFile.name,
          engagement: eng.rows,
          projects: proj.rows,
          clientClaim: session?.email
            ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
            : undefined,
        },
      });
      if (res?.success) {
        setReport(res.report);
        setEngFile(null);
        setProjFile(null);
        onImported();
      }
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Não foi possível importar os arquivos.');
    } finally {
      setBusy(false);
    }
  };

  const shown = report ?? lastReport;

  return (
    <section className="bg-card rounded-lg p-6 border border-border space-y-4">
      <div>
        <h3 className="text-base font-medium text-foreground">Importar base</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Envie os dois arquivos exportados do monday (CSV ou XLSX). As colunas são lidas pelo nome do cabeçalho. A importação substitui a base anterior.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <FilePick id="file-engagement" label="Análise de Engajamento" hint="Elemento, E-mail, Equipe, Departamento, Ativo pela última vez, Início da semana, Date, Status do usuário" file={engFile} onPick={setEngFile} />
        <FilePick id="file-projects" label="Histórico de Projetos" hint="Elemento, Nome SGI, Sigla do projeto, Status do projeto, Gerente atual, Eixo de projeto, Cliente, Início real da operação" file={projFile} onPick={setProjFile} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={run}
          disabled={busy || !engFile || !projFile}
          className="h-11 px-5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? 'Importando...' : 'Importar arquivos'}
        </button>
      </div>

      {missing.length > 0 && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1.5">
          <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="w-4 h-4" /> Faltam colunas. Nada foi salvo.</p>
          {missing.map((m) => (
            <p key={m.file}>{m.file}: {m.cols.join(', ')}</p>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {report && (
        <p className="text-xs text-foreground flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Base importada e salva.</p>
      )}

      {shown && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{report ? 'Resultado desta importação' : 'Última importação'}</p>
          <ReportBlock report={shown} />
        </div>
      )}
    </section>
  );
}
