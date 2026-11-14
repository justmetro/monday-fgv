import { SITUACAO_EQUIPE_LABEL, fmtDate, type Row } from '@generated/lib/painel';

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

function esc(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportarCsv(rows: Row[]) {
  const header = [
    'Grupo', 'Projeto', 'Sigla', 'Código', 'Status', 'Gerente atual', 'Cliente', 'Eixo',
    'Último produto previsto', 'Fonte do último produto', 'Dias até o fim', 'Equipe',
    'Custo Total mensal (R$)', 'Equipe Base', 'Custo Base mensal (R$)', 'Status',
    'Realocar', 'Manter', 'Desligar', 'Custo até o fim (R$)', 'Produtos restantes', 'Produtos atrasados',
    'Perspectiva de renovação/aditivo', 'Temperatura da perspectiva', 'Decisão', 'Meses de manutenção',
    'Manter até', 'Atualização da equipe', 'Situação da equipe', 'Quadro do projeto',
  ];
  const lines = rows.map((r) => {
    const p = r.projeto;
    const d = r.decisao;
    return [
      r.grupo, p.name, p.sigla ?? '', p.codigo ?? '', p.status ?? '', p.gerentes.join(', '), p.clientes.join(', '),
      p.eixo ?? '', r.termino.date ? fmtDate(r.termino.date) : '', r.termino.fonte ?? '', num(r.dias),
      num(r.clt), num(r.custoMensal), num(r.base.n), num(r.base.custoMensal), r.statusCat ?? '',
      num(r.resumoSim.Realocar.n), num(r.resumoSim.Manter.n), num(r.resumoSim.Desligar.n), num(r.custoAteTermino),
      num(r.pendentes), num(r.atrasados), r.perspectiva ?? '', r.temperatura ?? '',
      r.decisaoLabel ?? '', num(r.meses), r.manterAte ? fmtDate(r.manterAte) : '',
      d?.atualizacaoEquipe ? fmtDate(d.atualizacaoEquipe) : '', SITUACAO_EQUIPE_LABEL[r.situacaoEquipe], p.quadroUrl ?? '',
    ].map((v) => esc(String(v))).join(';');
  });
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `projetos-ativos-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
