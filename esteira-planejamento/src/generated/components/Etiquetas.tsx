/** "Não assinado": project without Data de Assinatura, visible in the current-year default view. */
export function NaoAssinado() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[var(--radius-sm)] border border-[hsl(var(--info)/0.4)] bg-[hsl(var(--info-soft))] px-1.5 py-px text-[11px] font-medium text-[hsl(var(--info))]"
      title="Sem Data de Assinatura — incluído no ano corrente como 'Em planejamento'">
      Não assinado
    </span>
  );
}
