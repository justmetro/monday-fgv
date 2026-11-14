import { ExternalLink } from 'lucide-react';
import { colorFor } from '@generated/lib/colors';
import { UserX, Users } from 'lucide-react';
import { rawVal, textVal } from '@generated/lib/engine';
import { canon, pillVars, PILL_CLS } from '@generated/lib/normalize';
import { AgeBadge } from '@generated/components/Age';
import { EditableField } from '@generated/components/edit/Editable';
import { EDITABLE, kindOf } from '@generated/lib/editing';
import { cn } from '@lib/utils';

export function Pill({ fieldKey, label, className }) {
  const text = canon(label);
  if (!text || typeof text !== 'string') return <span className="text-muted-foreground">—</span>;
  // Exact label color from the board's status settings (data-driven, so applied inline); ink picked for contrast
  const color = colorFor(fieldKey, label);
  return (
    <span title={text} className={cn('inline-flex max-w-[220px] items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium', PILL_CLS, className)} style={pillVars(color)}>
      <span className="truncate">{text}</span>
    </span>
  );
}

export function Tag({ children }) {
  return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">{children}</span>;
}

export function Cell({ field, item }) {
  if (field.age) { const a = field.age(item); return a ? <AgeBadge {...a} /> : <span className="text-muted-foreground">—</span>; }
  const ek = kindOf(field.key, item);
  if (ek) return <EditableField fieldKey={field.key} item={item} type={EDITABLE[ek][field.key]} />;
  const v = rawVal(field, item);
  if (field.type === 'status') return <Pill fieldKey={field.key} label={v} />;
  if (field.type === 'list') {
    if (!Array.isArray(v) || !v.length) return <span className="text-muted-foreground">—</span>;
    return <span className="flex flex-wrap gap-1">{v.slice(0, 3).map((x) => <Tag key={x}>{canon(x)}</Tag>)}{v.length > 3 && <Tag>+{v.length - 3}</Tag>}</span>;
  }
  if (field.type === 'link') {
    if (!v?.url) return <span className="text-muted-foreground">—</span>;
    return (
      <a href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary hover:underline">
        {v.label && v.label !== v.url ? v.label : 'Abrir'} <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  const t = textVal(field, item);
  if (!t || t === '—') return <span className="text-muted-foreground">—</span>;
  if (field.type === 'number' || field.type === 'date') return <span className="tabular-nums">{t}</span>;
  return <span className="line-clamp-2" title={t}>{t}</span>;
}

export function PessoaName({ match, className }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className="truncate" title={match._pessoa}>{match._pessoa || 'Match sem nome'}</span>
      {match._multiPerfil && <Users className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" aria-label="Mais de um perfil vinculado"><title>Mais de um perfil vinculado</title></Users>}
      {match._semPerfil && <UserX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sem perfil vinculado"><title>Sem perfil vinculado</title></UserX>}
    </span>
  );
}

export function GlowDot({ className }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[var(--glow-dot)]', className)} />;
}
