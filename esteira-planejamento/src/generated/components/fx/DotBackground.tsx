/** Light dotted background + top glow (two CSS layers, no element per dot). Render once, behind everything. */
export function DotBackground() {
  return (
    <>
      <div aria-hidden className="fx-dots" />
      <div aria-hidden className="fx-glow" />
    </>
  );
}
