import { useEffect, useState } from 'react';
import { Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPmoEmails, savePmoEmails } from '@generated/server/storage';
import { useUserSession } from '@generated/hooks/useUserSession';

export function PmoEmailsPanel() {
  const { session } = useUserSession();
  const [ownerEmail, setOwnerEmail] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (list: string[], owner: string) => {
    setOwnerEmail(owner);
    setText(list.filter((e) => e !== owner).join('\n'));
  };

  useEffect(() => {
    // Só consulta depois que a sessão confirmar o acesso de gestão
    if (!session?.canManage) return;
    getPmoEmails({
      data: session?.email
        ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
        : undefined,
    })
      .then((res) => apply(res?.pmoEmails ?? [], res?.ownerEmail ?? ''))
      .catch((e) => console.error('Erro ao ler lista do PMO:', e));
  }, [session]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const list = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const res = await savePmoEmails({
        data: {
          emails: list,
          clientClaim: session?.email
            ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
            : undefined,
        },
      });
      if (res?.success) {
        apply(res.pmoEmails, ownerEmail);
        setMessage({ ok: true, text: 'Lista do PMO salva.' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ ok: false, text: (e as Error).message || 'Não foi possível salvar a lista.' });
    } finally {
      setSaving(false);
    }
  };

  const count = text.split(/[\n,;]+/).filter((s) => s.includes('@')).length;

  return (
    <section className="bg-card rounded-lg p-6 border border-border space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h3 className="text-base font-medium text-foreground">Lista de e-mails do PMO</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Quem estiver nesta lista vê o Painel geral, o Painel do Gerente e esta aba.</p>
      </div>

      {ownerEmail && (
        <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-xs text-foreground">
          <Lock className="w-3 h-3 text-muted-foreground" /> {ownerEmail} · dono (sempre incluído)
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="pmo-emails" className="block text-xs font-medium text-foreground">Demais e-mails (um por linha ou separados por vírgula)</label>
        <textarea
          id="pmo-emails"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full text-xs p-3 rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{count} e-mail(s) além do dono</span>
        <button onClick={save} disabled={saving} className="h-10 px-4 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar lista'}
        </button>
      </div>

      {message && (
        <p className={`text-xs flex items-center gap-1.5 ${message.ok ? 'text-foreground' : 'text-destructive'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}
    </section>
  );
}
