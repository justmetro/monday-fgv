// Fluxo de validação de férias/licenças — vale SOMENTE para o departamento Projetos.
// Os outros departamentos seguem como antes (sem validação). Usado na tela e no servidor (mesma regra).
import { normText } from './weekdays';

export interface FlowAbsence {
  email: string;
  fluxo?: 'projetos'; // marcado no cadastro quando a pessoa é do departamento Projetos
  status?: 'pendente' | 'validado';
  validadoPor?: { id: string; name: string; email: string };
  removido?: boolean;
}

export interface FlowActor {
  email: string; // e-mail de quem está agindo (normalizado)
  isManagerOfPerson: boolean; // gerente de algum projeto da pessoa (Histórico de projetos)
}

// Na Base o departamento vem como "Projeto" (singular). "Sup Projetos" NÃO entra (é outro departamento).
export const PROJETOS_DEPTS = ['projeto', 'projetos'];

/** A pessoa é do departamento Projetos (igualdade normalizada; aceita lista separada por vírgula). */
export function isProjetosDepartment(dept: string | null | undefined): boolean {
  return (dept ?? '').split(/[,;]/).some((d) => PROJETOS_DEPTS.includes(normText(d)));
}

/** O período tira a pessoa do engajamento? Projetos: só depois de validado. Removido: nunca. */
export function countsAsAbsence(a: FlowAbsence): boolean {
  if (a.removido) return false;
  if (a.fluxo === 'projetos') return a.status === 'validado';
  return true;
}

type Decision = { ok: true } | { ok: false; reason: string };
const no = (reason: string): Decision => ({ ok: false, reason });
const isSelf = (a: FlowAbsence, actor: FlowActor) => a.email.toLowerCase().trim() === actor.email.toLowerCase().trim();

/** Validar: só o gerente da pessoa, só se pendente, nunca a própria. */
export function canValidate(a: FlowAbsence, actor: FlowActor): Decision {
  if (a.fluxo !== 'projetos') return no('Este período não usa validação.');
  if (a.removido) return no('Este período foi removido.');
  if (a.status === 'validado') return no('Este período já está validado.');
  if (isSelf(a, actor)) return no('Você não pode validar as próprias férias.');
  if (!actor.isManagerOfPerson) return no('Somente o gerente dos projetos desta pessoa pode validar.');
  return { ok: true };
}

/** Apagar/remover. Consultor: só o próprio e pendente. Gerente: só o que ele mesmo validou. */
export function canRemove(a: FlowAbsence, actor: FlowActor): Decision {
  if (a.fluxo !== 'projetos') return { ok: true }; // demais departamentos: regra antiga
  if (a.removido) return no('Este período já foi removido.');
  if (a.status !== 'validado') {
    if (isSelf(a, actor)) return { ok: true };
    return no('O gerente só pode remover férias que ele mesmo validou.');
  }
  if (a.validadoPor?.email && a.validadoPor.email.toLowerCase().trim() === actor.email.toLowerCase().trim()) return { ok: true };
  if (isSelf(a, actor)) return no('Férias já validadas pelo gerente não podem ser alteradas nem apagadas.');
  return no('Somente o gerente que validou pode remover este período.');
}

/** Alterar datas: só o consultor, só enquanto pendente. */
export function canEdit(a: FlowAbsence, actor: FlowActor): Decision {
  if (a.fluxo !== 'projetos') return { ok: true };
  if (a.removido) return no('Este período foi removido.');
  if (a.status === 'validado') return no('Férias já validadas pelo gerente não podem ser alteradas.');
  if (!isSelf(a, actor)) return no('Somente a própria pessoa altera um período pendente.');
  return { ok: true };
}
