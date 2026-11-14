import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { QUADS, QUAL_LABEL, DIM_LABEL, PESOS } from '@generated/lib/aderencia';
import { QUANT_LABEL, STATE_LABEL } from '@generated/lib/autoMatch';
import { evText } from '@generated/lib/competencias';
import { QUALI } from '@generated/lib/config';
import { COMPAT_LABEL, FAMILIAS } from '@generated/lib/compatibilidadeArea';
import ConfirmFamilia from '@generated/components/automatch/ConfirmFamilia';
import { cn } from '@lib/utils';

const tok = (v) => `border-[hsl(var(--${v})/0.5)] bg-[hsl(var(--${v})/0.12)] text-[hsl(var(--${v}))]`;
export const QUAD_CLS = {
  indicar: tok('success'), verificar: tok('warning'), potencial: tok('info'), descartar: 'border-border bg-muted text-muted-foreground',
};
const Tag = ({ cls, children, title }) => <span title={title} className={cn('inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[11px]', cls)}>{children}</span>;
export const TAG = { green: tok('success'), orange: tok('warning'), red: 'border-destructive/50 bg-destructive/10 text-destructive', gray: 'border-border bg-muted text-muted-foreground', purple: tok('alert') };

const compatCls = (c) => (c.semInfo || c.generalista ? TAG.gray : c.level === 2 ? TAG.green : c.level === 1 ? TAG.orange : TAG.red);
const compatTxt = (c) => (c.generalista ? COMPAT_LABEL.generalista : c.possivelIncompat ? COMPAT_LABEL.possivel : c.semInfo ? COMPAT_LABEL.none : COMPAT_LABEL[c.level]);
export const CompatBadge = ({ c }) => (c ? <Tag cls={compatCls(c)} title={c.motivo}>{compatTxt(c)}</Tag> : null);
const STATE_CLS = { ok: TAG.green, atencao: TAG.orange, risco: TAG.red, semdado: TAG.gray };

const Src = ({ s }) => (s === 'explicita' ? <Tag cls={TAG.green}>Família de área</Tag> : s === 'inferida' ? <Tag cls={TAG.gray}>Área inferida</Tag> : null);

function CompatBlock({ c, quad }) {
  if (!c) return null;
  const fam = (l) => (l.length ? l.map((f) => FAMILIAS[f]).join(', ') : 'sem informação');
  const regra = c.level === 0 ? 'Incompatível (ambos os lados com área explícita ou inferência forte) → Descartar, fora do ranking principal.' : c.possivelIncompat ? 'Possível incompatibilidade com área inferida por sinal fraco → tratada como parcial (nunca descarta automaticamente).' : c.generalista ? 'Perfil generalista → parcial, nunca fica em Indicar.'
    : c.level === 1 ? 'Parcial → nunca fica em Indicar (no máximo Verificar ou Potencial).' : 'Compatível → fluxo normal da matriz.';
  return (
    <section className="rounded-md border border-border p-2">
      <p className="flex items-center gap-2 text-sm font-medium">Compatibilidade de área <CompatBadge c={c} /></p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Perfil</dt><dd className="flex flex-wrap items-center gap-1">{fam(c.perfil)} <Src s={c.pSource} />{c.pSource === 'inferida' && <ConfirmFamilia itemId={c.perfilId} name={c.perfilName} fams={c.perfil} kind="perfil" />}</dd>
        <dt className="text-muted-foreground">Vaga</dt><dd className="flex flex-wrap items-center gap-1">{fam(c.vaga)} <Src s={c.vSource} />{c.vSource === 'inferida' && <ConfirmFamilia itemId={c.vagaId} name={c.vagaName} fams={c.vaga} kind="vaga" />}</dd>
        <dt className="text-muted-foreground">Motivo</dt><dd>{c.motivo}</dd>
        <dt className="text-muted-foreground">Regra</dt><dd>{regra} Quadrante final: {QUADS[quad].label}.</dd>
      </dl>
      <p className="mt-1 text-[11px] text-muted-foreground">A coluna “Família de área” tem precedência; sem ela, a família é inferida pela proporção das áreas/eixo + palavras do papel (perfil) ou do título/cargo (vaga). Tabela de pares provisória — revisar com a gestão.</p>
    </section>
  );
}

export const QuadBadge = ({ quad, className }) => <Tag cls={cn(QUAD_CLS[quad], 'font-medium', className)} title={QUADS[quad].hint}>{QUADS[quad].label}</Tag>;

function Dots({ n }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${n} de 3`}>
      {[1, 2, 3].map((i) => <span key={i} className={cn('h-2 w-2 rounded-full border border-primary/60', n >= i ? 'bg-primary' : n >= i - 0.5 ? 'bg-primary/40' : 'bg-transparent')} />)}
      <span className="ml-1 tabular-nums text-muted-foreground">{n.toLocaleString('pt-BR')}</span>
    </span>
  );
}

function Why({ s }) {
  const q = s.qual;
  return (
    <div className="flex flex-col gap-3 text-xs">
      <CompatBlock c={s.compat} quad={s.quad} />
      <section>
        <p className="flex items-center gap-2 text-sm font-medium">Viabilidade <Tag cls={TAG.gray}>{QUANT_LABEL[s.quant]} · {s.total.toLocaleString('pt-BR')}/100</Tag></p>
        <p className="mt-0.5 text-muted-foreground">Faixa: qualquer risco → Baixo; nenhum alerta → Alto; senão Médio. O número serve só para desempate.</p>
        <ul className="mt-1.5 grid gap-1.5">
          {s.parts.map((p) => (
            <li key={p.k} className="flex flex-wrap items-center justify-between gap-x-2">
              <span className="flex items-center gap-1.5">{p.k} <Tag cls={STATE_CLS[p.state]}>{STATE_LABEL[p.state]}</Tag> <span className="text-muted-foreground">{p.note}</span></span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{p.v.toLocaleString('pt-BR')}/{p.max}</span>
              <span className="basis-full text-[11px] text-muted-foreground">Regra: {p.rule}</span>
            </li>
          ))}
          <li className="text-muted-foreground">Urgência (desempate final): {s.urgencia == null ? 'sem data de disponibilidade' : s.urgencia === 0 ? 'disponível agora ou no futuro (sem penalidade)' : `desalocado há ${s.urgencia} dias`}</li>
        </ul>
      </section>
      <section>
        <p className="flex items-center gap-2 text-sm font-medium">Qualitativo <Tag cls={TAG.gray}>{QUAL_LABEL[q.band]} · {q.index.toLocaleString('pt-BR')}/100</Tag></p>
        <p className="mt-0.5 text-muted-foreground">Competências-chave {q.source === 'vaga' ? 'da vaga (Essenciais/Desejáveis)' : 'derivadas do eixo/cargo (peso 0,5; não geram gap crítico)'} · Dados do perfil: {q.cover}/{QUALI.DIMENSOES}{q.dadosInsuf ? ' (insuficiente: não pode ficar em Indicar)' : ''}.</p>
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left">
            <thead><tr className="text-muted-foreground"><th className="py-1 pr-2 font-normal">Dimensão</th><th className="py-1 pr-2 font-normal">Nota</th><th className="py-1 pr-2 font-normal">Evidência</th><th className="py-1 font-normal">Cruzou com</th></tr></thead>
            <tbody className="align-top">
              {q.dims.map((d) => (
                <tr key={d.k} className="border-t border-border">
                  <td className="py-1.5 pr-2">{DIM_LABEL[d.k]} <span className="text-muted-foreground">({PESOS[d.k]})</span></td>
                  <td className="whitespace-nowrap py-1.5 pr-2"><Dots n={d.nota} /></td>
                  <td className="py-1.5 pr-2">{d.empty ? <Tag cls={TAG.gray}>sem informação</Tag> : d.evid ? <span className="italic">{evText(d.evid)}{d.evid.weak ? ' (termo genérico, meia evidência)' : ''}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-1.5 text-muted-foreground">{d.cross}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <MatchTags s={s} />
    </div>
  );
}

export function MatchTags({ s, compact }) {
  const t = s.qual?.tags;
  if (!t) return null;
  const items = [
    ...t.gaps.map((g) => [TAG.red, `Gap crítico: ${g.c}`, evText(g.ev)]),
    ...t.possibleGaps.map((g) => [TAG.orange, `Possível gap: ${g.c}`, evText(g.ev)]),
    ...(s.qual.dadosInsuf ? [[TAG.orange, `Dados insuficientes (${s.qual.cover}/${QUALI.DIMENSOES})`]] : []),
    ...(s.qual.confiancaBaixa && !compact ? [[TAG.gray, 'Confiança baixa (vaga sem competências preenchidas)']] : []),
    ...(s.urgencia > 0 ? [[TAG.gray, `Desalocado há ${s.urgencia} dias`]] : []),
    ...(compact ? [] : t.strong.map((c) => [TAG.green, c])),
    ...(compact ? [] : t.develop.map((c) => [TAG.orange, `a desenvolver: ${c}`])),
    ...(compact ? [] : t.empty.map((c) => [TAG.gray, `sem informação: ${c}`])),
    ...t.alerts.map((a) => [TAG.purple, compact ? 'alerta nas observações' : a]),
  ];
  if (!items.length) return null;
  const seen = new Set();
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {items.filter(([, l]) => (seen.has(l) ? false : seen.add(l))).map(([cls, l, tip]) => <Tag key={l} cls={cls} title={tip ?? l}>{l}</Tag>)}
    </div>
  );
}

// Row badges: quadrant + quali band + quanti band, opening "Por que esse match".
export const MatchBadges = memo(function MatchBadges({ s }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} title="Por que esse match" className="inline-flex shrink-0 items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <QuadBadge quad={s.quad} />
          <CompatBadge c={s.compat} />
          <Tag cls={TAG.gray}>Quali {QUAL_LABEL[s.qual.band]}</Tag>
          <Tag cls={TAG.gray}>Quanti {QUANT_LABEL[s.quant]}</Tag>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-[min(94vw,560px)] overflow-y-auto">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">Por que esse match <QuadBadge quad={s.quad} /></p>
        <Why s={s} />
      </PopoverContent>
    </Popover>
  );
});
