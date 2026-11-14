import { Database, ExternalLink, Info, Table2 } from 'lucide-react';
import { BOARD_IND } from '@generated/lib';
import ItemLink from '@generated/ItemLink';

const btn = 'inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted';

/** "Fonte do dado" — standard for every indicator; measurement link has priority over the indicator link */
export default function FonteDado({ i, med, single }) {
  const f = i.fonte ?? {};
  const base = med?.base ?? f.base;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold"><Database className="h-4 w-4 text-[hsl(var(--goal))]" /> Fonte do dado</h3>
      <dl className="space-y-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Forma de coleta</dt>
          <dd className={f.coleta ? 'font-medium' : 'italic text-muted-foreground'}>{f.coleta ?? 'não informada'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Fórmula de cálculo</dt>
          <dd className={f.formula ? 'whitespace-pre-line break-words' : 'italic text-muted-foreground'}>{f.formula ?? 'não informada'}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        {base && (
          <a href={base.url} target="_blank" rel="noreferrer" className={btn} title={base.url}>
            <ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">{base.text || 'Abrir base de dados'}</span>
          </a>
        )}
        <ItemLink board={BOARD_IND} view="med" id={single ? med?.id : null} className={btn}><Table2 className="h-4 w-4" /> Ver na tabela MEDIÇÃO <ExternalLink className="h-3.5 w-3.5 opacity-70" /></ItemLink>
        <ItemLink board={BOARD_IND} view="ind" id={i.id} className={btn}><Table2 className="h-4 w-4" /> Ver na tabela INDICADORES <ExternalLink className="h-3.5 w-3.5 opacity-70" /></ItemLink>
      </div>
      {!base && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Base de dados não cadastrada — preencha a coluna Base de dados no{' '}
            <ItemLink board={BOARD_IND} view="ind" id={i.id} className="inline-flex items-center gap-0.5 font-semibold underline">indicador <ExternalLink className="h-3 w-3" /></ItemLink>.</span>
        </p>
      )}
    </section>
  );
}
