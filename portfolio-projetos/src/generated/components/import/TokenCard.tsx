import { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getTokenStatus, removeToken, saveToken } from '@generated/server/token';
import { fmtDateTime } from '@generated/lib/format';

type Status = Awaited<ReturnType<typeof getTokenStatus>>;

export function TokenCard({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getTokenStatus({ data: {} }).then((s) => setStatus(s ?? null)).catch((e) => { console.error(e); setErr('Não foi possível verificar seu acesso.'); }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await saveToken({ data: { token: value } });
      setStatus({ configured: true, mondayName: r.mondayName, savedAt: r.savedAt });
      setValue(''); setEditing(false);
      toast.success('Token salvo', { description: `Importações usarão o acesso de ${r.mondayName}.` });
      onChange?.();
    } catch (e) { console.error(e); setErr(e instanceof Error ? e.message : 'Não foi possível salvar o token.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr(null);
    const prev = status;
    setStatus({ configured: false, mondayName: null, savedAt: null });
    try { await removeToken({ data: {} }); toast.success('Token removido'); onChange?.(); }
    catch (e) { console.error(e); setStatus(prev); setErr('Não foi possível remover o token.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />;
  const configured = status?.configured;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {configured ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--ok))]" aria-hidden /> : <KeyRound className="mt-0.5 size-5 shrink-0 text-[hsl(var(--warn))]" aria-hidden />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Seu acesso à Monday para importar</h2>
            {configured ? (
              <p className="text-sm text-muted-foreground">Usando o token pessoal de <span className="font-medium text-foreground">{status?.mondayName}</span> · salvo em {fmtDateTime(status?.savedAt)}. Você verá as áreas de trabalho e quadros que acessa na Monday.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem token, a importação só enxerga as áreas liberadas para o aplicativo. Informe o token do seu perfil (Monday → foto do perfil → Desenvolvedores → Meu token de acesso).</p>
            )}
          </div>
        </div>
        {configured && !editing && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setEditing(true)} disabled={busy} className="min-h-10 rounded-md border border-border px-3 text-sm">Trocar</button>
            <button onClick={() => void remove()} disabled={busy} className="min-h-10 rounded-md border border-destructive/40 px-3 text-sm text-destructive">Remover</button>
          </div>
        )}
      </div>
      {(!configured || editing) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Cole aqui o seu token pessoal" aria-label="Token pessoal da Monday" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm" />
          <button onClick={() => void save()} disabled={busy || value.trim().length < 20} className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Validar e salvar
          </button>
          {editing && <button onClick={() => { setEditing(false); setValue(''); }} className="min-h-10 rounded-md border border-border px-3 text-sm">Cancelar</button>}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <p className="mt-2 text-xs text-muted-foreground">O token é validado com a Monday, só é aceito se for do seu próprio usuário, fica guardado no servidor do aplicativo e nunca é exibido novamente. Ele é usado apenas para leitura.</p>
    </section>
  );
}
