import { fmtBRL } from '@generated/lib/painel';
import { MODALIDADES, type ContagemModalidade } from '@generated/lib/negocio';

/** Totalizador do grupo: pessoas por modalidade + custo total e base (mensal). */
export function GrupoTotais({ g }: { g: { nome: string; porModalidade: ContagemModalidade; custo: number; custoBase: number } }) {
  const partes = MODALIDADES.map((m) => `${g.porModalidade[m]} ${m}`).join(', ');
  return (
    <p className="tnum text-xs text-muted-foreground">
      <span className="text-foreground">{g.nome}:</span> {partes}
      <span className="mx-1.5" aria-hidden>·</span>Custo Total {fmtBRL(g.custo)}/mês
      <span className="mx-1.5" aria-hidden>·</span>Custo Base {fmtBRL(g.custoBase)}/mês
    </p>
  );
}
