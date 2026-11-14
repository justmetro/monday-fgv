import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { fmtNum } from '@generated/lib';

/** "(i)" — how many measurements were loaded and why the others were left out */
export default function LoadInfo({ carga, updatedAt }) {
  if (!carga) return null;
  const fora = carga.fora.reduce((s, x) => s + x.qtd, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Carga dos dados: ${fmtNum(carga.usadas)} medições usadas, ${fmtNum(fora)} fora`}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Info className="h-3.5 w-3.5" /> Atualizado às {updatedAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm">
        <p className="font-semibold">Medições do grupo "Medição do indicador"</p>
        <p className="mt-1 text-muted-foreground">{fmtNum(carga.usadas)} usadas de {fmtNum(carga.total)} · recarrega sozinho a cada 2 min</p>
        {fora > 0 ? (
          <ul className="mt-2 space-y-1">
            {carga.fora.map((x) => <li key={x.motivo} className="flex justify-between gap-3"><span>{x.motivo}</span><span className="font-semibold tabular-nums">{fmtNum(x.qtd)}</span></li>)}
          </ul>
        ) : <p className="mt-2">Nenhuma medição ficou de fora.</p>}
        {(carga.semStatus > 0 || carga.viaPrazo > 0) && (
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {carga.semStatus > 0 && `${fmtNum(carga.semStatus)} sem status entraram como mês fechado. `}
            {carga.viaPrazo > 0 && `${fmtNum(carga.viaPrazo)} sem Período de Referência usaram o mês do prazo.`}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
