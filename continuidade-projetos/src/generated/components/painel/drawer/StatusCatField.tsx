import { Tag } from 'lucide-react';
import { RascunhoTag } from '@generated/components/painel/Chips';
import { SelectField } from '@generated/components/painel/Fields';

/** Campo "Status" (categorização) no topo do painel do projeto; grava em Decisões do Vibe ao salvar. */
export function StatusCatField({ value, onChange, opcoes, sujo }: {
  value: string | null; onChange: (v: string | null) => void; opcoes: string[]; sujo: boolean;
}) {
  const lista = value && !opcoes.includes(value) ? [...opcoes, value] : opcoes;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor="f-status-cat" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tag className="size-3.5" aria-hidden /> Status
      </label>
      <div className="w-full max-w-[240px]">
        <SelectField id="f-status-cat" value={value} onChange={onChange} options={lista} placeholder="Sem status" />
      </div>
      {sujo && <RascunhoTag />}
    </div>
  );
}
