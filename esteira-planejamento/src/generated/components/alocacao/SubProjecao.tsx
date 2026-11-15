import { useEffect, useMemo, useState } from 'react';
import { Switch } from '@components/ui/switch';
import { cn } from '@lib/utils';
import { TEMP_COR, casaDestino } from '@generated/lib/alocacao';
import { InfoDica } from '@generated/components/ui-bits';
import { btnNeutro } from '@generated/components/alocacao/cards';
import { DOT } from '@generated/components/alocacao/cores';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { ImportarDialog } from '@generated/components/alocacao/ImportarDialog';
import { PendentesImportacao } from '@generated/components/alocacao/PendentesImportacao';
import { ASSINADO, COLUNAS_ESTEIRA, EsteiraPactuacao, COM_PROJ, SEM_PROJ } from '@generated/components/alocacao/EsteiraPactuacao';
import { DestinoSheet } from '@generated/components/alocacao/DestinoSheet';
import { BarraMassa, CheckTodos, useSelecao } from '@generated/components/alocacao/selecao';

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span className="flex flex-col rounded-[var(--radius-md)] border border-border bg-card px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{rotulo}</span>
      <span className="tnum text-lg font-semibold leading-tight text-foreground">{valor}</span>
    </span>
  );
}

/** Esteira de Projetos: ONLY projects without a manager in the 02.01, one column per temperature. */
export function SubProjecao({ ctx }: { ctx: AlocCtx }) {
  const { modelo, q } = ctx;
  const [importar, setImportar] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [mostrarAssinados, setMostrarAssinados] = useState(false);
  const base = useMemo(() => modelo.semGerente.filter((d) => !d.comGerente && casaDestino(q, d)), [modelo.semGerente, q]);
  // Visible projects = the ones inside the six fixed columns ("Assinado" only when shown). Every number on this sub-tab comes from this list.
  const lista = useMemo(
    () => base.filter((d) => (COLUNAS_ESTEIRA as string[]).includes(d.temp.valor) && (mostrarAssinados || d.temp.valor !== ASSINADO)),
    [base, mostrarAssinados],
  );
  const nAssinados = base.filter((d) => d.temp.valor === ASSINADO).length;
  const com = lista.filter((d) => d.projecoes.length > 0).length;
  const s = useSelecao(lista);
  const { reportarContagem } = ctx;
  useEffect(() => { reportarContagem('projecao', lista.length); }, [reportarContagem, lista.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Numero rotulo={COM_PROJ} valor={com} />
          <Numero rotulo={SEM_PROJ} valor={lista.length - com} />
          <Numero rotulo="Total" valor={lista.length} />
          <InfoDica texto={`Regra: só projetos novos (sem gerente na relação Gerente do 02.01) que aparecem nas colunas abaixo${mostrarAssinados ? '' : ' (assinados ocultos)'}. Com projeção de alocação = ao menos uma projeção no app (gerente, CDPE, externo ou Novo gerente). Total = Com + Sem = projetos visíveis, respeitando a busca.`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-2.5 text-xs text-muted-foreground md:h-8">
            <label htmlFor="esteira-mostrar-assinados" className="cursor-pointer whitespace-nowrap">Mostrar assinados ({nAssinados})</label>
            <Switch id="esteira-mostrar-assinados" checked={mostrarAssinados} onCheckedChange={setMostrarAssinados} />
          </span>
          <button type="button" onClick={() => setImportar(true)} className={btnNeutro}>Importar prioridades de Negócios</button>
        </div>
      </div>

      <PendentesImportacao ctx={ctx} />

      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          Visão da esteira de projetos com demanda por alocação de gerente, considerando a temperatura contratual e/ou urgência de execução
        </p>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda de temperaturas">
          {COLUNAS_ESTEIRA.map((t) => (
            <li key={t} className="flex items-center gap-1"><span className={cn('size-2 rounded-full', DOT[TEMP_COR[t]])} aria-hidden />{t}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <CheckTodos s={s} n={lista.length} />
        <span>Selecionar todos ({lista.length})</span>
        {s.selecionados.length > 0 && <span className="tnum text-foreground">· {s.selecionados.length} selecionado(s)</span>}
      </div>

      <EsteiraPactuacao lista={lista} mostrarAssinados={mostrarAssinados} onAbrir={setAberto} s={s} />

      <DestinoSheet ctx={ctx} id={aberto} onClose={() => setAberto(null)} />
      <ImportarDialog ctx={ctx} open={importar} onOpenChange={setImportar} />
      <BarraMassa ctx={ctx} s={s} />
    </div>
  );
}
