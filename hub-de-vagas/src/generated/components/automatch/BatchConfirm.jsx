import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { FAMILIAS, familiaLabels, FAMILIA_COL } from '@generated/lib/compatibilidadeArea';
import { confirmMany, requestReload } from '@generated/lib/familiaWrite';

const fam = (l) => l.map((f) => FAMILIAS[f]).join(', ');
const via = (a) => a.triggers.map((t) => (t.via === 'palavra' ? `“${t.term}”` : `${t.term} (dropdown)`)).filter((x, i, s) => s.indexOf(x) === i).join(', ');

// Section 5: families inferred by keyword only + batch "Confirmar sugestões selecionadas".
export default function BatchConfirm({ inferidos }) {
  const [sel, setSel] = useState(() => new Set());
  const [onlyWords, setOnlyWords] = useState(true);
  const [ask, setAsk] = useState(false);
  const [prog, setProg] = useState(null);
  const [result, setResult] = useState(null);
  const list = useMemo(() => inferidos.filter((x) => !onlyWords || x.a.onlyWords), [inferidos, onlyWords]);
  const k = (x) => `${x.kind}:${x.item.id}`;
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = inferidos.filter((x) => sel.has(k(x)));

  const run = async () => {
    setAsk(false); setResult(null);
    const res = await confirmMany(picked.map((x) => ({ id: x.item.id, name: x.item.name, fams: x.a.fams })), (d, t) => setProg({ d, t }));
    setProg(null); setResult(res); setSel(new Set());
    if (res.ok.length) requestReload(res.ok.map((x) => ({ id: x.id, labels: x.labels })));
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Famílias inferidas ({list.length})</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox id="only-words" checked={onlyWords} onCheckedChange={(v) => setOnlyWords(!!v)} /><label htmlFor="only-words">Só as vindas de palavra-chave</label></div>
      </div>
      <div className="max-h-64 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="w-8 p-2"><span className="sr-only">Selecionar</span></th><th className="p-2 text-left font-normal">Item</th><th className="p-2 text-left font-normal">Sugestão</th><th className="p-2 text-left font-normal">Disparada por</th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={k(x)} className="border-t border-border">
                <td className="p-2"><Checkbox checked={sel.has(k(x))} onCheckedChange={() => toggle(k(x))} aria-label={`Selecionar ${x.item.name}`} /></td>
                <td className="p-2"><span className="block truncate font-medium">{x.item.name}</span><span className="text-muted-foreground">{x.kind === 'vaga' ? 'Vaga' : 'Perfil'}</span></td>
                <td className="p-2">{fam(x.a.fams)}</td>
                <td className="p-2 text-muted-foreground">{via(x.a)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum item inferido.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSel(new Set(list.map(k)))} disabled={!list.length} className="h-8 rounded-full border border-border px-3 text-xs disabled:opacity-50">Marcar todos visíveis</button>
        <button onClick={() => setAsk(true)} disabled={!picked.length || !!prog} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {prog && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{prog ? `Gravando ${prog.d} de ${prog.t}…` : `Confirmar sugestões selecionadas (${picked.length})`}
        </button>
        {result && <span className="text-xs">{result.ok.length} gravado(s){result.fail.length ? <span className="text-destructive"> · {result.fail.length} falha(s): {result.fail.map((f) => `${f.name} (${f.msg})`).join('; ')}</span> : ''}</span>}
      </div>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gravar {picked.length} família(s) de área?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="max-h-60 overflow-auto text-sm">
                A coluna “{FAMILIA_COL.title}” será preenchida em {picked.length} item(ns):
                <ul className="mt-2 list-disc pl-5">{picked.map((x) => <li key={k(x)}>{x.item.name} → {familiaLabels(x.a.fams).join(', ')}</li>)}</ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={run}>Gravar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
