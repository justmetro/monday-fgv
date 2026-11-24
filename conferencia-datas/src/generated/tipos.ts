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
  linkQuadro: string; linkSGI: string;
  desaloca: string; saidas: string;
}

export const DESALOCA = { toda: 'Toda a equipe na data de fim', parte: 'Parte da equipe sai antes' } as const;

export interface Registro { id: string; em: string; usuarioId: string; usuario: string; perfil: string; acao: string; itemId: string; projeto: string; detalhe: string }

export interface Eu{ id: string; nome: string; email: string; coplan: boolean }
