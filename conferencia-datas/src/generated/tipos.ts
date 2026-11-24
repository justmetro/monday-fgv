export const STATUS = ['Não iniciado', 'Revisar datas', 'Datas conferidas', 'Datas corrigidas', 'Atualizado no 02.01'] as const;

export interface Item {
  id: string;
  nome: string;
  gerentes: { id: string; nome: string }[];
  emails: string[];
  status: string;
  vigDe: string; vigAte: string; ultimo: string;
  vigOkDe: string; vigOkAte: string; ultimoOk: string;
  obs: string; id02: string; prazo: string;
}

export interface Eu { id: string; nome: string; email: string; coplan: boolean }
