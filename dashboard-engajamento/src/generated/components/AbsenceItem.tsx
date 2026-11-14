import { useState } from 'react';
import { BadgeCheck, Clock, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import type { AbsenceDoc } from '@generated/models';
import { formatBR } from '@generated/lib/dates';
import { canEdit, canRemove, canValidate, type FlowActor } from '@generated/lib/vacationFlow';

interface Props {
  abs: AbsenceDoc & { id: string };
  actor: FlowActor;
  canEditLegacy: boolean; // cadastros fora do fluxo (outros departamentos/antigos): regra antiga
  gestao?: boolean; // dono, admin ou PMO no Painel Geral: edita e exclui qualquer afastamento
  busy: boolean;
  onValidate: (id: string) => void;
  onRemove: (id: string) => void;
  onSave?: (id: string, v: { tipo: 'Férias' | 'Licença'; inicio: string; volta: string | null }) => Promise<boolean>;
}

const day = (iso: string) => formatBR(new Date(iso + 'T00:00:00'));
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const who = (p?: { name: string; email: string }) => (p ? `${p.name || 'Sistema'}${p.email ? ` (${p.email})` : ''}` : 'Sistema');
const field = 'h-9 w-full rounded border border-input bg-background px-2 text-xs';

/** Um período de afastamento: status, quem registrou/editou (com origem) e as ações permitidas. */
export function AbsenceItem({ abs, actor, canEditLegacy, gestao = false, busy, onValidate, onRemove, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [tipo, setTipo] = useState<'Férias' | 'Licença'>(abs.tipo as 'Férias' | 'Licença');
  const [inicio, setInicio] = useState(abs.inicio);
  const [volta, setVolta] = useState(abs.volta ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const flow = abs.fluxo === 'projetos';
  const validated = abs.status === 'validado';
  const showValidate = flow && !abs.removido && canValidate(abs, actor).ok;
  const showRemove = !abs.removido && (gestao || (flow ? canRemove(abs, actor).ok : canEditLegacy));
  const showEdit = Boolean(onSave) && !abs.removido && (gestao || (flow ? canEdit(abs, actor).ok : canEditLegacy));
  const removeLabel = flow && validated && !gestao ? 'Remover férias validadas' : 'Apagar afastamento';

  const submit = async () => {
    setLocalError(null);
    if (!inicio) return setLocalError('Informe o início.');
    if (volta && volta <= inicio) return setLocalError('A data de volta ao trabalho deve ser posterior à data de início.');
    if (onSave && (await onSave(abs.id, { tipo, inicio, volta: volta || null }))) setEditing(false);
  };

  return (
    <div className={`p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-2 ${abs.removido ? 'opacity-60' : ''}`}>
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{abs.tipo}</span>
          {flow && !abs.removido && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${validated ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}`}>
              {validated ? <BadgeCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {validated ? 'Validado' : 'Pendente de validação'}
            </span>
          )}
          {abs.removido && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">Removido</span>}
          <span className={`font-medium text-foreground ${abs.removido ? 'line-through' : ''}`}>
            {day(abs.inicio)} até {abs.volta ? day(abs.volta) : 'sem volta definida'}
          </span>
        </div>
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <select aria-label="Tipo" className={field} value={tipo} onChange={(e) => setTipo(e.target.value as 'Férias' | 'Licença')}>
              <option value="Férias">Férias</option>
              <option value="Licença">Licença</option>
            </select>
            <input aria-label="Início" type="date" className={field} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <input aria-label="Volta (opcional)" type="date" className={field} value={volta} onChange={(e) => setVolta(e.target.value)} />
            <div className="sm:col-span-3 flex items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void submit()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">Salvar alterações</button>
              <button type="button" onClick={() => { setEditing(false); setLocalError(null); }} className="h-8 px-3 rounded border border-border text-[11px]">Cancelar</button>
              {localError && <span className="text-[11px] text-destructive">{localError}</span>}
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Registrado por {who(abs.criadoPor)} em {when(abs.criadoEm)}{abs.criadoOrigem ? ` · ${abs.criadoOrigem}` : ''}
        </p>
        {abs.atualizadoEm && (
          <p className="text-[10px] text-muted-foreground">
            Editado por {who(abs.atualizadoPor)} em {when(abs.atualizadoEm)}{abs.atualizadoOrigem ? ` · ${abs.atualizadoOrigem}` : ''}
          </p>
        )}
        {flow && validated && <p className="text-[10px] text-muted-foreground">Validado por {abs.validadoPor?.name ?? '—'} em {when(abs.validadoEm)}</p>}
        {flow && !validated && !abs.removido && <p className="text-[10px] text-muted-foreground">Continua contando no engajamento até o gerente validar.</p>}
        {abs.removido && <p className="text-[10px] text-muted-foreground">Removido por {abs.removidoPor?.name ?? '—'} em {when(abs.removidoEm)}{abs.removidoOrigem ? ` · ${abs.removidoOrigem}` : ''} · voltou a contar no engajamento</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showValidate && (
          <button type="button" disabled={busy} onClick={() => onValidate(abs.id)}
            className="h-8 px-2.5 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Validar
          </button>
        )}
        {showEdit && !editing && (
          <button type="button" disabled={busy} onClick={() => setEditing(true)} aria-label="Editar afastamento" title="Editar afastamento"
            className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {showRemove && (
          <button type="button" disabled={busy} onClick={() => onRemove(abs.id)} aria-label={removeLabel} title={removeLabel}
            className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
