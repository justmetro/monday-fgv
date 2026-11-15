import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { type Projeto, codigoDe, fmtDate, DASH } from '@generated/lib/format';
import { NomeLink } from '@generated/components/NomeLink';
import { MiniFarois } from '@generated/components/carga-bits';
import { FarolLegenda } from '@generated/components/farol-legenda';
import { useAbrirProjeto } from '@generated/components/AbrirProjeto';

export interface ProjetoTermino { p: Projeto; termino: Date | null }
export interface ProjecaoGerente { id: string; p: Projeto; tipo: string; temp: string; inicio: string; detalhe: string }
/** Manager portfolio for the side panel: active, closed (02.01 "Gerente" column) and pending projections (app). */
export interface CarteiraGerente { ativos: ProjetoTermino[]; encerrados: ProjetoTermino[]; projecoes: ProjecaoGerente[] | null }

/** Code button: opens the project panel (the manager panel closes first — see AbrirFechando). */
function Codigo({ p }: { p: Projeto }) {
  const abrir = useAbrirProjeto();
  return (
    <button type="button" onClick={() => abrir?.(p)} aria-label={`Abrir detalhes de ${p.name}`} title="Abrir detalhes"
      className="font-mono-code self-start rounded-[var(--radius-sm)] text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {codigoDe(p) ?? DASH}
    </button>
  );
}

/** Project without Último Produto Previsto: counted as active, end date unknown. */
export function SemPrevisao() {
  return (
    <span className="mt-0.5 inline-flex w-fit items-center rounded-[var(--radius-sm)] border border-border px-1.5 py-px text-[11px] text-[hsl(var(--fg-subtle))]"
      title="Sem Último Produto Previsto — considerado ativo">
      Sem previsão de término
    </span>
  );
}

const Vazio = ({ t }: { t: string }) => <p className="py-2 text-[13px] text-muted-foreground">{t}</p>;
const lista = (v: string[] | null | undefined) => (v?.length ? v.join(', ') : DASH);
const trigger = 'h-11 flex-none px-3 text-[13px] md:h-8';

export function GerenteAbas({ c }: { c: CarteiraGerente }) {
  return (
    <Tabs defaultValue="ativos" className="gap-3">
      <TabsList variant="line" className="h-auto w-full justify-start border-b border-border p-0">
        <TabsTrigger value="ativos" className={trigger}>Ativos <span className="tnum text-muted-foreground">{c.ativos.length}</span></TabsTrigger>
        <TabsTrigger value="encerrados" className={trigger}>Encerrados <span className="tnum text-muted-foreground">{c.encerrados.length}</span></TabsTrigger>
        <TabsTrigger value="projecoes" className={trigger}>Projeções {c.projecoes && <span className="tnum text-muted-foreground">{c.projecoes.length}</span>}</TabsTrigger>
      </TabsList>

      <TabsContent value="ativos">
        {c.ativos.length === 0 ? <Vazio t="Nenhum projeto ativo." /> : (
          <ul className="-mx-2 flex flex-col">
            {c.ativos.map(({ p, termino }) => (
              <li key={p.id} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 hover:bg-[hsl(var(--surface-2))]">
                <MiniFarois p={p} />
                <span className="flex min-w-0 flex-1 flex-col"><Codigo p={p} /><NomeLink p={p} className="text-[13px] font-normal" />
                  {!termino && <SemPrevisao />}
                </span>
                <span className="tnum shrink-0 text-right text-xs text-muted-foreground" title="Último Produto Previsto">
                  <span className="block text-[10px] text-[hsl(var(--fg-subtle))]">término</span>{fmtDate(termino)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <FarolLegenda className="mt-3" />
      </TabsContent>

      <TabsContent value="encerrados">
        {c.encerrados.length === 0 ? <Vazio t="Nenhum projeto encerrado." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead className="text-[11px] text-muted-foreground">
                <tr><th scope="col" className="py-1.5 pr-2 font-medium">Projeto</th><th scope="col" className="px-2 py-1.5 font-medium">Eixo</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">UF</th><th scope="col" className="py-1.5 pl-2 text-right font-medium">Término</th></tr>
              </thead>
              <tbody>
                {c.encerrados.map(({ p, termino }) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="max-w-[220px] py-2 pr-2"><span className="flex flex-col"><Codigo p={p} /><NomeLink p={p} className="text-[13px] font-normal" /></span></td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{lista(p.eixo)}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{lista(p.uf)}</td>
                    <td className="tnum py-2 pl-2 text-right text-xs text-muted-foreground">{termino ? termino.getFullYear() : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="projecoes">
        {!c.projecoes ? <Vazio t="Projeções disponíveis na aba Gestão Alocação de Gerentes." />
          : c.projecoes.length === 0 ? <Vazio t="Nenhuma projeção pendente para este gerente." /> : (
            <ul className="-mx-2 flex flex-col">
              {c.projecoes.map((x) => (
                <li key={x.id} className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-md)] px-2 py-2 hover:bg-[hsl(var(--surface-2))]">
                  <span className="flex items-center gap-2"><Codigo p={x.p} /><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.tipo}</span></span>
                  <NomeLink p={x.p} className="text-[13px] font-normal" />
                  <span className="text-xs text-muted-foreground">Temp. {x.temp} · {x.inicio}</span>
                  <span className="text-[11px] text-[hsl(var(--fg-subtle))]">{x.detalhe}</span>
                </li>
              ))}
            </ul>
          )}
      </TabsContent>
    </Tabs>
  );
}
