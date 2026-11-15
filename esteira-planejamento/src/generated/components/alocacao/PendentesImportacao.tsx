import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@lib/utils';
import { codigoDe } from '@generated/lib/format';
import { TEMP_COR, type Temp } from '@generated/lib/alocacao';
import { BuscaCombo, Chip, quando } from '@generated/components/alocacao/bits';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

/** Report lines of the last import without a 02.01 match: link (applies the temperature) or dismiss. */
export function PendentesImportacao({ ctx }: { ctx: AlocCtx }) {
  const { dados, modelo, api } = ctx;
  const [aberto, setAberto] = useState(false);
  const lista = dados.importPendentes;
  if (!lista.length) return null;
  const opcoes = modelo.todos.map((d) => ({ id: d.p.id, label: d.p.name, sub: codigoDe(d.p) ?? undefined }));

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-card">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px]">
        <span className="font-semibold text-foreground">Pendentes da última importação ({lista.length})</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          sem correspondência no 02.01 · {lista[0] ? `${lista[0].data.autor} · ${quando(lista[0].data.em)}` : ''}
          <ChevronDown className={cn('size-4 transition-transform duration-150', aberto && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {aberto && (
        <ul className="divide-y divide-border border-t border-border">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
              <span className="min-w-0 flex-1 basis-64">
                <span className="block text-foreground">{p.data.nomeRelatorio}</span>
                {p.data.etapa && <span className="block text-[11px] text-[hsl(var(--fg-subtle))]">{p.data.etapa}</span>}
              </span>
              {p.data.temp && <Chip corVar={TEMP_COR[p.data.temp as Temp] ?? '--temp-sem'}>{p.data.temp}</Chip>}
              <BuscaCombo itens={opcoes} placeholder="Buscar projeto do 02.01…"
                onPick={(i) => {
                  void (async () => {
                    if (p.data.temp && (await api.ajustar('temperatura', i.id, p.data.temp))) await api.descartarPendente(p.id);
                    else if (!p.data.temp) await api.descartarPendente(p.id);
                  })();
                }}
                gatilho={<button type="button" className="h-11 rounded-[var(--radius-sm)] border border-input px-2 text-xs hover:bg-accent md:h-7">Vincular a projeto</button>} />
              <button type="button" onClick={() => void api.descartarPendente(p.id)} className="h-11 px-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground md:h-7">Descartar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
