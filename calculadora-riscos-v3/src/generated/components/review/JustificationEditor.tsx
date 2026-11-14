import { useEffect, useId, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Textarea } from '@components/ui/textarea';

export function JustificationEditor({
  initial,
  disabled,
  onSave,
  autoFocus,
}: {
  initial: string | null;
  disabled: boolean;
  onSave: (text: string) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    setText(initial ?? '');
  }, [initial]);

  const dirty = text.trim() !== (initial ?? '').trim();

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const ok = await onSave(text.trim());
    setSaving(false);
    if (ok) setSaved(true);
  };

  return (
    <div>
      <label htmlFor={fieldId} className="mono-label mb-1.5 block text-[hsl(var(--text-dim))]">
        Justificativa da aplicabilidade
      </label>
      <Textarea
        id={fieldId}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        disabled={disabled}
        rows={3}
        placeholder="Explique por que o risco se aplica (ou não) a este projeto."
        className="min-h-20 rounded-md border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] text-base md:text-sm"
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        {saved && !dirty && (
          <span className="mono-label inline-flex items-center gap-1 text-[hsl(var(--success))]">
            <Check className="size-3" aria-hidden /> Salvo no 09.4
          </span>
        )}
        <button type="button" className="cta-pill" onClick={save} disabled={disabled || saving || !dirty}>
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {saving ? 'Salvando' : 'Salvar justificativa'}
        </button>
      </div>
    </div>
  );
}
