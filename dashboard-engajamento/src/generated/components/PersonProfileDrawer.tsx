import { useEffect, useRef, useState } from 'react';
import {
  X,
  User,
  Mail,
  Building,
  FolderKanban,
  UserCheck,
  Calendar,
  Plus,
  AlertCircle,
  CheckCircle2,
  Palmtree,
  FileText,
} from 'lucide-react';
import type { PersonWeek } from '@generated/lib/engagementMetrics';
import type { AbsenceDoc } from '@generated/models';
import { saveAbsence, deleteAbsence, validateAbsence } from '@generated/server/storage';
import { AbsenceItem } from './AbsenceItem';
import { DailyScoreSummary, DailyWeeksList } from './DailyScoreCard';
import { shortDate } from '@generated/lib/dates';
import { useUserSession } from '@generated/hooks/useUserSession';

interface Props {
  person: PersonWeek | null;
  onClose: () => void;
  canEditAbsence?: boolean; // true no Meu Perfil e no Painel do Gerente para pessoas dos projetos dele
  viewAsManager?: string;
  origem?: 'geral' | 'gerente'; // tela de onde a ação parte (Painel Geral = gestão de qualquer pessoa)
  focusAbsenceForm?: boolean; // abre já rolando até o cadastro de afastamento
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged?: () => void;
}

export function PersonProfileDrawer({
  person,
  onClose,
  canEditAbsence = false,
  viewAsManager,
  origem = 'gerente',
  focusAbsenceForm = false,
  absences,
  onAbsenceChanged,
}: Props) {
  const absenceRef = useRef<HTMLDivElement>(null);
  const personKeyNow = person?.key;
  useEffect(() => {
    if (personKeyNow && focusAbsenceForm) absenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [personKeyNow, focusAbsenceForm]);
  const { session } = useUserSession();
  const [tipo, setTipo] = useState<'Férias' | 'Licença'>('Férias');
  const [inicio, setInicio] = useState('');
  const [volta, setVolta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!person) return null;

  const clientClaim = session?.email
    ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin }
    : undefined;

  // Afastamentos exclusivos desta pessoa
  const personAbsences = absences.filter(
    (a) => a.email.toLowerCase().trim() === person.email.toLowerCase().trim()
  );

  const handleAddAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inicio) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const saved = await saveAbsence({
        data: {
          email: person.email,
          tipo,
          inicio,
          volta: volta ? volta : null,
          clientClaim,
          origem,
          viewAsManager,
        },
      });

      setSuccess(saved?.status === 'validado' ? 'Afastamento registrado e já validado por você.' : saved?.status === 'pendente' ? 'Afastamento registrado como pendente de validação.' : 'Afastamento registrado com sucesso.');
      setInicio('');
      setVolta('');
      onAbsenceChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Não foi possível salvar o afastamento.');
    } finally {
      setBusy(false);
    }
  };

  const myEmail = (session?.email ?? '').toLowerCase().trim();
  const actor = { email: myEmail, isManagerOfPerson: canEditAbsence && person.email.toLowerCase().trim() !== myEmail };

  const handleValidateAbsence = async (id: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await validateAbsence({ data: { id, clientClaim, viewAsManager } });
      setSuccess('Férias validadas. O período saiu do engajamento.');
      onAbsenceChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Não foi possível validar.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (id: string, v: { tipo: 'Férias' | 'Licença'; inicio: string; volta: string | null }) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveAbsence({ data: { id, email: person.email, ...v, origem, clientClaim, viewAsManager } });
      setSuccess('Afastamento atualizado.');
      onAbsenceChanged?.();
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
          origem,
          clientClaim,
          viewAsManager,
        },
      });
      setSuccess('Afastamento removido.');
      onAbsenceChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Não foi possível excluir o afastamento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-background border-l border-border h-full shadow-2xl flex flex-col overflow-hidden text-foreground animate-in slide-in-from-right duration-300">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm shrink-0">
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">{person.name}</h2>
              <p className="text-xs text-muted-foreground truncate">{person.email || 'Sem e-mail cadastrado'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar ficha"
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Topo fixo: score geral e último acesso conhecido */}
        <div className="p-5 pb-3 border-b border-border shrink-0">
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <DailyScoreSummary personKey={person.key} />
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Dias em que a pessoa esteve, por semana (a lista tem rolagem própria) */}
          <div className="space-y-2">
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Dias com acesso, por semana</h4>
            <DailyWeeksList personKey={person.key} />
          </div>

          {/* Dados Organizacionais e de Projetos */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Dados e Alocações</h3>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Departamentos</span>
                  <span className="text-foreground font-medium">
                    {person.departments.length > 0 ? person.departments.join(', ') : 'Sem departamento'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                <FolderKanban className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Projetos Ativos</span>
                  <span className="text-foreground font-medium">
                    {person.activeProjects.length > 0 ? person.activeProjects.join(', ') : 'Nenhum projeto ativo associado'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Gerentes Atuais</span>
                  <span className="text-foreground font-medium">
                    {person.managers.length > 0 ? person.managers.join(', ') : 'Sem gerente'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Equipes Registradas</span>
                  <span className="text-foreground">{person.teams.join(', ') || 'Nenhuma'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Férias e Licença */}
          <div ref={absenceRef} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palmtree className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Afastamentos (Férias e Licença)
                </h3>
              </div>
              {!canEditAbsence && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Somente leitura</span>
              )}
            </div>

            {/* Lista de afastamentos */}
            <div className="space-y-2">
              {personAbsences.length === 0 ? (
                <p className="p-3.5 rounded-lg border border-border bg-card text-muted-foreground text-[11px]">
                  Nenhum afastamento registrado para este colaborador.
                </p>
              ) : (
                personAbsences.map((abs) => (
                  <AbsenceItem key={abs.id} abs={abs} actor={actor} canEditLegacy={canEditAbsence} gestao={origem === 'geral' && canEditAbsence} busy={busy} onSave={canEditAbsence ? handleSaveEdit : undefined}
                    onValidate={(id) => void handleValidateAbsence(id)} onRemove={(id) => void handleDeleteAbsence(id)} />
                ))
              )}
            </div>

            {/* Formulário de Adicionar Afastamento (se tiver permissão de edição) */}
            {canEditAbsence && (
              <form onSubmit={handleAddAbsence} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="font-medium text-foreground text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" /> Registrar novo afastamento
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="drawer-absence-tipo" className="block text-[11px] text-muted-foreground mb-1">Tipo</label>
                    <select
                      id="drawer-absence-tipo"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as 'Férias' | 'Licença')}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-foreground text-xs"
                    >
                      <option value="Férias">Férias</option>
                      <option value="Licença">Licença</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="drawer-absence-inicio" className="block text-[11px] text-muted-foreground mb-1">Data de Início</label>
                    <input
                      id="drawer-absence-inicio"
                      type="date"
                      required
                      value={inicio}
                      onChange={(e) => setInicio(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-foreground text-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="drawer-absence-volta" className="block text-[11px] text-muted-foreground mb-1">Data de Volta (opcional)</label>
                    <input
                      id="drawer-absence-volta"
                      type="date"
                      value={volta}
                      onChange={(e) => setVolta(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">Volta = 1º dia de trabalho</span>
                  <button
                    type="submit"
                    disabled={busy || !inicio}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Salvar afastamento
                  </button>
                </div>
              </form>
            )}

            {/* Mensagens de Sucesso ou Erro */}
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}

            {success && (
              <p className="text-xs text-foreground flex items-center gap-1.5 bg-primary/10 p-2.5 rounded-lg border border-primary/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> {success}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
