import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import type { IndicatorClassDoc, IndicatorDoc } from '@generated/models';
import { saveClass } from '@generated/server/intel';
import { ikey } from '@generated/lib/intel-sig';

const uniq = (a: string[]) => [...new Set(a)].sort((x, y) => x.localeCompare(y, 'pt-BR'));

export function EditClassDialog({ ind, cls, classes, projName, onClose, onSaved }: { ind: IndicatorDoc | null; cls: IndicatorClassDoc | null; classes: IndicatorClassDoc[]; projName: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [v, setV] = useState({ tema: '', subtema: '', familia: '', publico: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV({ tema: cls?.tema ?? '', subtema: cls?.subtema ?? '', familia: cls?.familia ?? '', publico: cls?.publico ?? '' }); }, [cls, ind]);
  if (!ind) return null;
  const save = async (revisado: boolean) => {
    if (!v.tema.trim() || !v.subtema.trim() || !v.familia.trim()) return toast.error('Informe tema, subtema e família.');
    setBusy(true);
    try {
      await saveClass({ data: { key: ikey(ind.projectBoardId, ind.itemId), tema: v.tema, subtema: v.subtema, familia: v.familia, publico: v.publico || null, revisado } });
      toast.success(revisado ? 'Classificação revisada' : 'Classificação salva');
      await onSaved(); onClose();
    } catch (e) { console.error(e); toast.error('Não foi possível salvar a classificação.'); }
    finally { setBusy(false); }
  };
  const texts: [string, string | null][] = [['Descrição', ind.descricao], ['Objetivo', ind.objetivo], ['Tipo', ind.tipo], ['Unidade', ind.unidade], ['Fórmula de cálculo', ind.formula], ['Temporalidade', ind.temporalidade], ['Polaridade', ind.polaridade]];
  const field = (key: 'tema' | 'subtema' | 'familia' | 'publico', label: string, list: string[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input list={`dl-${key}`} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
      <datalist id={`dl-${key}`}>{list.map((o) => <option key={o} value={o} />)}</datalist>
    </label>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ind.name}</DialogTitle>
          <DialogDescription>{projName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <dl className="space-y-2 rounded-md bg-muted/60 p-3 text-sm">
            {texts.map(([l, t]) => <div key={l}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</dt><dd className="whitespace-pre-wrap break-words">{t || '—'}</dd></div>)}
          </dl>
          <div className="space-y-3">
            {cls && <p className="rounded-md border border-border p-2 text-xs text-muted-foreground">Origem: {cls.origem === 'ia' ? 'IA' : cls.origem === 'manual' ? 'manual' : 'IA revisada'} · confiança {cls.confianca} · v{cls.taxonomiaVersao}<br />{cls.justificativa}{cls.textoAlterado && <><br /><b className="text-destructive">O texto do indicador mudou após a revisão.</b></>}</p>}
            {field('tema', 'Tema', uniq(classes.map((c) => c.tema)))}
            {field('subtema', 'Subtema', uniq(classes.filter((c) => !v.tema || c.tema === v.tema).map((c) => c.subtema)))}
            {field('familia', 'Família de indicadores', uniq(classes.map((c) => c.familia)))}
            {field('publico', 'Público-alvo (opcional)', uniq(classes.map((c) => c.publico ?? '').filter(Boolean)))}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button onClick={() => void save(false)} disabled={busy} className="min-h-10 rounded-md border border-border px-3 text-sm">Salvar sem revisar</button>
              <button onClick={() => void save(true)} disabled={busy} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground">{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Salvar como revisada</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
