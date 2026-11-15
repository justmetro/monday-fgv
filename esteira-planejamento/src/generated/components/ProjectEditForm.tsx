import type { ReactNode } from 'react';
import { type Projeto, fmtDate, txt, DASH } from '@generated/lib/format';
import { OPT } from '@generated/lib/board-options';
import { IT_KEYS, IT_LABEL, fmtIt, itValor } from '@generated/lib/metricas';
import { paresDe } from '@generated/lib/finance';
import {
  type Draft, LABEL, STATUS_KEYS, DATE_KEYS, NUM_KEYS, DD_KEYS, draftFrom,
} from '@generated/lib/edicao';
import { MultiSelect } from '@generated/components/MultiSelect';
import { Campo, SelectCampo, Bloqueado, inputCls } from '@generated/components/edit-fields';
import type { OpcoesEdicaoRes, GerenteOpcao } from '@generated/hooks/useOpcoesEdicao';
import { GerenteRelacao } from '@generated/components/GerenteRelacao';
import { Spinner } from '@components/ui/spinner';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-t border-border px-5 py-4">
      <legend className="sr-only">{titulo}</legend>
      <h3 aria-hidden className="mb-2.5 text-xs font-semibold text-muted-foreground">{titulo}</h3>
      {children}
    </fieldset>
  );
}

/** Board options + the item's current values (kept even if removed from the column settings). */
const comAtuais = (a: string[], atuais: string[]) => [...new Set([...a, ...atuais])].sort((x, y) => x.localeCompare(y, 'pt-BR'));

export interface EdicaoOpcoesProps {
  res: OpcoesEdicaoRes | null;
  loading: boolean;
  atualizar: () => void;
  gerentes: GerenteOpcao[] | null;
  gerentesLoading: boolean;
}

interface Props {
  projeto: Projeto;
  draft: Draft;
  setDraft: (d: Draft) => void;
  edicao: EdicaoOpcoesProps;
}

function AvisoOpcoes({ edicao }: { edicao: EdicaoOpcoesProps }) {
  const local = !edicao.loading && edicao.res?.fonte !== 'quadro';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 text-[11px] text-[hsl(var(--fg-subtle))]">
      <span className="inline-flex items-center gap-1.5">
        {edicao.loading ? (
          <><Spinner className="size-3" /> Carregando opções do quadro…</>
        ) : local ? (
          <span className="inline-flex items-center gap-1 text-[hsl(var(--warning))]">
            <AlertTriangle className="size-3" aria-hidden /> Usando lista local (não foi possível ler as opções do quadro)
          </span>
        ) : (
          'Opções lidas da configuração do quadro'
        )}
      </span>
      <button type="button" onClick={edicao.atualizar} disabled={edicao.loading}
        className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 md:h-6">
        <RefreshCw className="size-3" aria-hidden /> Atualizar opções
      </button>
    </div>
  );
}

export function ProjectEditForm({ projeto: p, draft, setDraft, edicao }: Props) {
  const base = draftFrom(p);
  const opts = edicao.res?.opts ?? OPT;
  const ddOpts = {
    eixo: comAtuais(opts.eixo, base.dds.eixo),
    uf: comAtuais(opts.uf, base.dds.uf),
    tipoPlanejamento: comAtuais(opts.tipoPlanejamento, base.dds.tipoPlanejamento),
    gerente1: comAtuais(opts.gerente1, base.dds.gerente1),
  };
  const id = (k: string) => `edit-${p.id}-${k}`;

  return (
    <div>
      <AvisoOpcoes edicao={edicao} />
      <Grupo titulo="Status">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STATUS_KEYS.map((k) => (
            <Campo key={k} id={id(k)} label={LABEL[k]} alterado={draft.status[k] !== base.status[k]}>
              <SelectCampo id={id(k)} value={draft.status[k]} options={opts[k]}
                onChange={(v) => setDraft({ ...draft, status: { ...draft.status, [k]: v } })} />
            </Campo>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Gerente">
        <GerenteRelacao projeto={p} draft={draft} setDraft={setDraft} gerentes={edicao.gerentes} loading={edicao.gerentesLoading}
          ddOpts={ddOpts.gerente1} id={id('gerente-rel')} />
      </Grupo>

      <Grupo titulo="Classificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DD_KEYS.map((k) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {LABEL[k]}
                {draft.dds[k].join('|') !== base.dds[k].join('|') && <span className="size-1.5 rounded-full bg-primary" aria-label="alterado" />}
              </span>
              <MultiSelect label={draft.dds[k].length ? draft.dds[k].join(', ') : `Selecionar ${LABEL[k].toLowerCase()}`}
                options={ddOpts[k]} value={draft.dds[k]} onChange={(v) => setDraft({ ...draft, dds: { ...draft.dds, [k]: v } })} />
            </div>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Datas">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DATE_KEYS.map((k) => (
            <Campo key={k} id={id(k)} label={LABEL[k]} alterado={draft.dates[k] !== base.dates[k]}>
              <input id={id(k)} type="date" value={draft.dates[k]} className={`${inputCls} [color-scheme:dark]`}
                onChange={(e) => setDraft({ ...draft, dates: { ...draft.dates, [k]: e.target.value } })} />
            </Campo>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Valores (R$)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NUM_KEYS.map((k) => (
            <Campo key={k} id={id(k)} label={LABEL[k]} alterado={draft.nums[k].replace(',', '.') !== base.nums[k]}>
              <input id={id(k)} type="number" inputMode="decimal" step="0.01" value={draft.nums[k]} className={`${inputCls} tnum text-right`}
                onChange={(e) => setDraft({ ...draft, nums: { ...draft.nums, [k]: e.target.value } })} />
            </Campo>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Calculados e vinculados (somente leitura)">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Bloqueado label="Ponto focal" value={p.pontoFocal?.map((x) => x.name).filter(Boolean).join(', ') || DASH} />
          <Bloqueado label="Vigência contratual" value={p.vignciaContratual ? `${fmtDate(p.vignciaContratual.from)} → ${fmtDate(p.vignciaContratual.to)}` : DASH} />
          <Bloqueado label="Cliente" value={txt(p.cliente)} />
          <Bloqueado label="Prazo de Conclusão" value={fmtDate(p.calcPrazoDeConcluso ?? p.prazoDeConcluso)} />
          <Bloqueado label="Prazo Registro SGI" value={fmtDate(p.calcPrazoRegistroSgi ?? p.prazoRegistroSgi)} />
          <Bloqueado label="Prazo Dimensionamento" value={fmtDate(p.prazoDimensionamento)} />
          <Bloqueado label="Mês Referência Resultado" value={txt(p.msRefernciaResultado)} />
          <Bloqueado label="Resultado Planejamento" value={txt(p.resultadoConclusoPlanejamento)} />
          <Bloqueado label="Resultado SGI" value={txt(p.resultadoSgi)} />
          <Bloqueado label="Tempo de Planejamento" value={txt(p.tempoDePlanejamento === 'null' ? null : p.tempoDePlanejamento)} />
          {paresDe(p).map((x) => <Bloqueado key={x.key} label={`Saldo ${x.label}`} value={`${txt(x.saldoRaw)} · ${txt(x.pctRaw)}`} />)}
          {IT_KEYS.map((k) => <Bloqueado key={k} label={IT_LABEL[k]} value={fmtIt(itValor(p[k]))} />)}
        </dl>
      </Grupo>
    </div>
  );
}
