import { useMemo, useState } from 'react';
import { Palmtree, Search } from 'lucide-react';
import type { AbsenceDoc } from '@generated/models';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import { saveAbsence, deleteAbsence, validateAbsence } from '@generated/server/storage';
import { useUserSession } from '@generated/hooks/useUserSession';
import { normText } from '@generated/lib/weekdays';
import { AbsenceItem } from '../AbsenceItem';

interface Props {
  weeks: WeekSummary[];
  absences: (AbsenceDoc & { id: string })[];
  canManage: boolean;
  onChanged: () => void;
}

const PAGE = 20;

/** Lista de afastamentos registrados (Painel Geral): filtro por tipo, busca por pessoa; edição para a gestão. */
export function AbsenceListCard({ weeks, absences, canManage, onChanged }: Props) {
  const { session } = useUserSession();
  const [tipo, setTipo] = useState<'all' | 'Férias' | 'Licença'>('all');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clientClaim = session?.email
    ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
    : undefined;
  const myEmail = (session?.email ?? '').toLowerCase().trim();

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    weeks.forEach((w) => w.people.forEach((p) => { if (p.email) m.set(p.email.toLowerCase().trim(), p.name); }));
    return m;
  }, [weeks]);

  const list = useMemo(() => {
    const q = normText(search);
    return absences
      .filter((a) => !a.removido)
      .filter((a) => tipo === 'all' || a.tipo === tipo)
      .filter((a) => {
        if (!q) return true;
        const email = a.email.toLowerCase().trim();
        return normText(`${nameByEmail.get(email) ?? ''} ${email}`).includes(q);
      })
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
  }, [absences, tipo, search, nameByEmail]);

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(ok);
      onChanged();
      return true;
    } catch (err) {
      console.error(fail, err);
      setError((err as Error).message || fail);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Palmtree className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Afastamentos registrados</h2>
          <span className="text-xs text-muted-foreground">{list.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar pessoa" placeholder="Buscar pessoa" value={search}
              onChange={(e) => { setSearch(e.target.value); setVisible(PAGE); }}
              className="h-9 w-48 rounded border border-input bg-background pl-8 pr-2 text-xs" />
          </div>
          <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setVisible(PAGE); }}
            className="h-9 rounded border border-input bg-background px-2 text-xs">
            <option value="all">Todos os tipos</option>
            <option value="Férias">Férias</option>
            <option value="Licença">Licença</option>
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">{error}</p>}
      {success && <output className="block text-xs text-foreground bg-muted rounded-lg p-2.5">{success}</output>}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhum afastamento encontrado.</p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, visible).map((a) => {
            const email = a.email.toLowerCase().trim();
            return (
              <div key={a.id} className="space-y-1">
                <p className="text-xs font-medium text-[hsl(var(--brand-navy))]">
                  {nameByEmail.get(email) ?? email} <span className="font-normal text-muted-foreground">{email}</span>
                </p>
                <AbsenceItem abs={a} actor={{ email: myEmail, isManagerOfPerson: false }} canEditLegacy={canManage} gestao={canManage} busy={busy}
                  onValidate={(id) => void run(() => validateAbsence({ data: { id, clientClaim } }), 'Férias validadas.', 'Não foi possível validar.')}
                  onRemove={(id) => void run(() => deleteAbsence({ data: { id, origem: 'geral', clientClaim } }), 'Afastamento removido.', 'Não foi possível excluir o afastamento.')}
                  onSave={canManage ? (id, v) => run(() => saveAbsence({ data: { id, email, ...v, origem: 'geral', clientClaim } }), 'Afastamento atualizado.', 'Não foi possível atualizar o afastamento.') : undefined} />
              </div>
            );
          })}
          {visible < list.length && (
            <button type="button" onClick={() => setVisible((v) => v + PAGE)} className="h-9 px-4 rounded border border-border text-xs font-medium hover:bg-muted">
              Mostrar mais
            </button>
          )}
        </div>
      )}
    </section>
  );
}
