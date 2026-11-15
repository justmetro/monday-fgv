import { codigoDe, fmtDate } from '@generated/lib/format';
import { urlItem } from '@generated/lib/links';
import { type ModeloAlocacao, type AlocDados, classificar, rotuloDestino, tipoDe, CAP_CURTO, TIPO_LABEL } from '@generated/lib/alocacao';

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolon CSV with BOM (opens correctly in Excel pt-BR). Browser-only. */
export function baixarCsv(nome: string, linhas: unknown[][]) {
  const conteudo = '\uFEFF' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const hoje = () => new Date().toISOString().slice(0, 10);

export function exportarGerentes(m: ModeloAlocacao, dados: AlocDados) {
  const linhas: unknown[][] = [[
    'Gerente', 'Capacidade', 'Capacidade ajustada', 'Eixos', 'Eixos ajustados', 'Projetos ativos (n)', 'Projetos ativos',
    'Término mais próximo', 'Projetos destino projetados', 'Comentário', 'Comentário por', 'Comentário em',
  ]];
  for (const g of m.gerentes) {
    linhas.push([
      g.g.nome, CAP_CURTO[g.cap.valor], g.cap.ajuste ? 'sim' : 'não', g.eixos.valor.join(', '), g.eixos.ajuste ? 'sim' : 'não',
      g.ativos.length, g.ativos.map((a) => `${codigoDe(a.p) ?? a.p.name} (${fmtDate(a.data)})`).join(' | '),
      fmtDate(g.termino), g.projecoes.map((x) => x.data.projetoNome).join(' | '),
      g.comentario?.data.texto ?? '', g.comentario?.data.autor ?? '', g.comentario?.data.em ?? '',
    ]);
  }
  void dados;
  baixarCsv(`alocacao-gerentes-${hoje()}.csv`, linhas);
}

export function exportarProjetos(m: ModeloAlocacao) {
  const linhas: unknown[][] = [[
    'Código', 'Projeto', 'Temperatura', 'Temperatura ajustada', 'Complexidade', 'Complexidade ajustada', 'Eixos',
    'Situação', 'Projeção', 'Status', 'Link 02.01',
  ]];
  for (const d of m.destinos) {
    const c = classificar(d);
    linhas.push([
      codigoDe(d.p) ?? '', d.p.name, d.temp.valor, d.temp.ajuste ? 'sim' : 'não', d.complex.valor ?? '', d.complex.ajuste ? 'sim' : 'não',
      (d.p.eixo ?? []).join(', '), d.comGerente ? 'Já alocado (gerente no 02.01)' : c === 'interno' ? 'Com projeção gerente interno' : c === 'novo' ? 'Novo gerente' : c === 'externo' ? 'Gerente externo' : 'Sem projeção',
      d.projecoes.map((x) => `${rotuloDestino(x.data)} (${TIPO_LABEL[tipoDe(x.data)]})`).join(', '), d.projecoes.length ? 'Pendente' : '', urlItem(d.p.id),
    ]);
  }
  baixarCsv(`alocacao-projetos-destino-${hoje()}.csv`, linhas);
}
