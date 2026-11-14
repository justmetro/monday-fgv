import { useMemo, useState } from 'react';
import {
  User,
  Building,
  FolderKanban,
  UserCheck,
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
  Palmtree,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { WeekSummary, PersonWeek } from '@generated/lib/engagementMetrics';
import type { AbsenceDoc } from '@generated/models';
import { saveAbsence, deleteAbsence } from '@generated/server/storage';
import { formatBR, shortDate } from '@generated/lib/dates';
import { useUserSession } from '@generated/hooks/useUserSession';
import { DailyScoreSummary, DailyWeeksList } from './DailyScoreCard';
import { AbsenceItem } from './AbsenceItem';

interface Props {
  weeks: WeekSummary[];
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged: () => void;
}

export function MyProfileTab({ weeks, absences, onAbsenceChanged }: Props) {
  const { session } = useUserSession();
  const [tipo, setTipo] = useState<'Férias' | 'Licença'>('Férias');
  const [inicio, setInicio] = useState('');
  const [volta, setVolta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userEmail = session?.email ? session.email.toLowerCase().trim() : '';

  // Localiza a pessoa na base consolidada
  const myPersonData: PersonWeek | null = useMemo(() => {
    if (!userEmail || weeks.length === 0) return null;
    const latestWeek = weeks[weeks.length - 1];
    if (!latestWeek) return null;
    return latestWeek.people.find((p) => p.email.toLowerCase().trim() === userEmail) || null;
  }, [userEmail, weeks]);

  // Afastamentos da própria pessoa
  const myAbsences = useMemo(() => {
    if (!userEmail) return [];
    return absences.filter((a) => a.email.toLowerCase().trim() === userEmail);
  }, [userEmail, absences]);

  const clientClaim = session?.email
    ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
    : undefined;

  const handleAddAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inicio || !userEmail) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const saved = await saveAbsence({
        data: {
          email: userEmail,
          tipo,
          inicio,
          volta: volta ? volta : null,
          origem: 'perfil',
          clientClaim,
        },
      });

      setSuccess(saved?.status === 'pendente' ? 'Seu afastamento foi registrado e está pendente de validação do gerente. Até lá, o período continua contando no engajamento.' : 'Seu afastamento foi registrado com sucesso.');
      setInicio('');
      setVolta('');
      onAbsenceChanged();
    } catch (err) {
      setError((err as Error).message || 'Não foi possível salvar seu afastamento.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (id: string, v: { tipo: 'Férias' | 'Licença'; inicio: string; volta: string | null }) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveAbsence({ data: { id, email: userEmail, ...v, origem: 'perfil', clientClaim } });
      setSuccess('Afastamento atualizado.');
      onAbsenceChanged();
      return true;
    } catch (err) {
      setError((err as Error).message || 'Não foi possível atualizar o afastamento.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteAbsence({
        data: {
          id,
          origem: 'perfil',
          clientClaim,
        },
      });
      setSuccess('Afastamento removido.');
      onAbsenceChanged();
    } catch (err) {
      setError((err as Error).message || 'Não foi possível excluir o afastamento.');
    } finally {
      setBusy(false);
    }
  };

  if (!myPersonData) {
    return (
      <div className="max-w-2xl mx-auto p-10 bg-card rounded-2xl border border-border text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-medium text-foreground">Seu e-mail não está na base</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O e-mail associado à sua conta do monday.com (<strong className="text-foreground">{session?.email || 'Desconhecido'}</strong>) não foi encontrado no arquivo de Análise de Engajamento importado.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho do Perfil */}
      <div className="bg-card rounded-xl p-6 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0">
            {myPersonData.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">{myPersonData.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{myPersonData.email}</p>
          </div>
        </div>
      </div>

      {/* Cartão de Score Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <DailyScoreSummary personKey={myPersonData.key} large />
        </div>

        <div className="p-5 rounded-xl border border-border bg-card space-y-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Último Acesso
          </span>
          <p className="text-xl font-medium text-foreground pt-1">
            {myPersonData.lastAccess ? formatBR(myPersonData.lastAccess) : 'Nenhum acesso registrado'}
          </p>
          <p className="text-xs text-muted-foreground">Maior data de login registrada nos arquivos importados</p>
        </div>
      </div>

      {/* Dias em que a pessoa esteve, por semana */}
      <div className="bg-card rounded-xl p-6 border border-border space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Meus dias com acesso, por semana</h2>
        <DailyWeeksList personKey={myPersonData.key} />
      </div>

      {/* Dados e Alocações */}
      <div className="bg-card rounded-xl p-6 border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Dados e Alocações</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <Building className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Departamento</span>
              <span className="text-foreground font-medium">
                {myPersonData.departments.length > 0 ? myPersonData.departments.join(', ') : 'Sem departamento'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Projetos Ativos</span>
              <span className="text-foreground font-medium">
                {myPersonData.activeProjects.length > 0 ? myPersonData.activeProjects.join(', ') : 'Sem projeto ativo associado'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Gerentes Atuais</span>
              <span className="text-foreground font-medium">
                {myPersonData.managers.length > 0 ? myPersonData.managers.join(', ') : 'Sem gerente'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Equipes na Base</span>
              <span className="text-foreground">{myPersonData.teams.join(', ') || 'Nenhuma'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gerenciamento de Férias e Licenças Próprias */}
      <div className="bg-card rounded-xl p-6 border border-border space-y-5">
        <div className="flex items-center gap-2">
          <Palmtree className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Meus Afastamentos (Férias e Licença)
          </h2>
        </div>

        {/* Lista de afastamentos existentes */}
        <div className="space-y-2">
          {myAbsences.length === 0 ? (
            <p className="p-4 rounded-lg border border-border bg-muted/20 text-muted-foreground text-xs">
              Você ainda não possui afastamentos registrados.
            </p>
          ) : (
            myAbsences.map((abs) => (
              <AbsenceItem key={abs.id} abs={abs} actor={{ email: userEmail, isManagerOfPerson: false }} canEditLegacy busy={busy} onSave={handleSaveEdit}
                onValidate={() => undefined} onRemove={(id) => void handleDeleteAbsence(id)} />
            ))
          )}
        </div>

        {/* Formulário para Adicionar */}
        <form onSubmit={handleAddAbsence} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3.5">
          <p className="font-medium text-foreground text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" /> Registrar novo período de afastamento
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="my-profile-absence-tipo" className="block text-[11px] text-muted-foreground mb-1">Tipo de Afastamento</label>
              <select
                id="my-profile-absence-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'Férias' | 'Licença')}
                className="w-full h-9 px-2.5 rounded border border-border bg-background text-foreground text-xs"
              >
                <option value="Férias">Férias</option>
                <option value="Licença">Licença</option>
              </select>
            </div>

            <div>
              <label htmlFor="my-profile-absence-inicio" className="block text-[11px] text-muted-foreground mb-1">Primeiro dia fora (Início)</label>
              <input
                id="my-profile-absence-inicio"
                type="date"
                required
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full h-9 px-2.5 rounded border border-border bg-background text-foreground text-xs"
              />
            </div>

            <div>
              <label htmlFor="my-profile-absence-volta" className="block text-[11px] text-muted-foreground mb-1">Primeiro dia de volta (Opcional)</label>
              <input
                id="my-profile-absence-volta"
                type="date"
                value={volta}
                onChange={(e) => setVolta(e.target.value)}
                className="w-full h-9 px-2.5 rounded border border-border bg-background text-foreground text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-muted-foreground">
              A semana que contém a volta conta normalmente.
            </span>
            <button
              type="submit"
              disabled={busy || !inicio}
              className="h-9 px-4 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Salvar afastamento
            </button>
          </div>
        </form>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-foreground flex items-center gap-1.5 bg-primary/10 p-3 rounded-lg border border-primary/20">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {success}
          </p>
        )}
      </div>
    </div>
  );
}
