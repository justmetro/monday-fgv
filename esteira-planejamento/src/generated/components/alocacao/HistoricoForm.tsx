import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { normNome } from '@generated/lib/nomes';
import type { Doc } from '@generated/lib/alocacao';
import type { AlocHistorico } from '@generated/models';
import { inputCls } from '@generated/components/edit-fields';
import { btnNeutro } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

const VAZIO = { gerenteNome: '', projetoNome: '', eixo: '', inicio: '', fim: '' };

/** Add / edit a manual record of the Histórico (saved in the app only). */
export function HistoricoForm({ ctx, nomes, gerentePadrao, editando, onClose }: {
  ctx: AlocCtx; nomes: string[]; gerentePadrao: string; editando: Doc<AlocHistorico> | 'novo' | null; onClose: () => void;
}) {
  const [f, setF] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (editando && editando !== 'novo') {
      const d = editando.data;
      setF({ gerenteNome: d.gerenteNome, projetoNome: d.projetoNome, eixo: d.eixo, inicio: d.inicio, fim: d.fim });
    } else if (editando === 'novo') setF({ ...VAZIO, gerenteNome: gerentePadrao });
  }, [editando, gerentePadrao]);

  const valido = f.gerenteNome.trim() && f.projetoNome.trim() && (!f.inicio || !f.fim || f.inicio <= f.fim);
  const salvar = async () => {
    if (!valido) return;
    setSalvando(true);
    const g = [...ctx.modelo.gerentes, ...ctx.modelo.desativados].find((x) => normNome(x.g.nome) === normNome(f.gerenteNome));
    const ok = await ctx.api.salvarHist({ ...f, gerenteId: g?.g.id ?? '', projetoNome: f.projetoNome.trim() }, editando && editando !== 'novo' ? editando.id : undefined);
    setSalvando(false);
    if (ok) onClose();
  };
  const eixos = [...new Set([...ctx.eixoOpts, ...(f.eixo ? [f.eixo] : [])])];

  return (
    <Dialog open={!!editando} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-lg rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
        <DialogHeader>
          <DialogTitle className="text-base">{editando === 'novo' ? 'Adicionar registro ao histórico' : 'Editar registro do histórico'}</DialogTitle>
          <DialogDescription className="text-[13px]">Registro manual salvo no app (o Mapa de Gerentes não é alterado).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:col-span-2">
            Gerente
            <select value={f.gerenteNome} onChange={(e) => setF({ ...f, gerenteNome: e.target.value })} className={inputCls}>
              <option value="">Selecione…</option>
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:col-span-2">
            Projeto
            <input value={f.projetoNome} onChange={(e) => setF({ ...f, projetoNome: e.target.value })} maxLength={300} className={inputCls} placeholder="Nome do projeto" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:col-span-2">
            Eixo
            <select value={f.eixo} onChange={(e) => setF({ ...f, eixo: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {eixos.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Início
            <input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Fim
            <input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
          </label>
        </div>
        {f.inicio && f.fim && f.inicio > f.fim && <p className="text-xs text-[hsl(var(--danger))]">O início deve ser anterior ao fim.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={salvando} className={btnNeutro}>Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={!valido || salvando} className={btnNeutro}>Salvar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
