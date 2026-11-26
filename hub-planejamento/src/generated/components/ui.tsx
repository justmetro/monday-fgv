import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
export function Botao({ variante = 'secundario', carregando, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const v = {
    primario: 'bg-primary text-primary-foreground hover:opacity-90',
    secundario: 'bg-secondary text-secondary-foreground hover:bg-muted',
    fantasma: 'text-foreground hover:bg-muted',
    perigo: 'bg-destructive text-destructive-foreground hover:opacity-90',
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 h-8 text-[13px] font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none', v, className)}>
      {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-card text-card-foreground border border-border/70 shadow-[0_1px_2px_rgba(0,0,0,.04)]', className)}>{children}</div>;
}

export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'ok' | 'aviso' | 'erro' | 'azul' }) {
  const t = {
    neutro: 'bg-muted text-muted-foreground',
    ok: 'bg-[hsl(var(--ok)/.12)] text-[hsl(var(--ok))]',
    aviso: 'bg-[hsl(var(--warn)/.14)] text-[hsl(var(--warn))]',
    erro: 'bg-destructive/10 text-destructive',
    azul: 'bg-accent text-accent-foreground',
  }[tom];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', t)}>{children}</span>;
}

export function Texto({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx('w-full rounded-lg border border-input bg-background/60 px-2.5 py-1.5 text-[13px] leading-snug outline-none focus:ring-2 focus:ring-ring/30 resize-y', className)} />;
}

export function Campo({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('w-full rounded-lg border border-input bg-background/60 px-2.5 h-8 text-[13px] outline-none focus:ring-2 focus:ring-ring/30', className)} />;
}

export function Escolha({ opcoes, className, valor, onMudar, vazio, ...p }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { opcoes: readonly string[]; valor: string | null | undefined; onMudar: (v: string) => void; vazio?: string }) {
  return (
    <select {...p} value={valor ?? ''} onChange={(e) => onMudar(e.target.value)}
      className={cx('rounded-lg border border-input bg-background/60 px-2 h-8 text-[13px] outline-none focus:ring-2 focus:ring-ring/30', className)}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {valor && !opcoes.includes(valor) && <option value={valor}>{valor} (fora da lista)</option>}
      {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{children}</div>;
}

export function Aviso({ tom = 'aviso', children }: { tom?: 'aviso' | 'erro' | 'info' | 'ok'; children: ReactNode }) {
  const t = {
    aviso: 'bg-[hsl(var(--warn)/.10)] text-foreground border-[hsl(var(--warn)/.35)]',
    erro: 'bg-destructive/10 text-foreground border-destructive/40',
    info: 'bg-accent text-accent-foreground border-transparent',
    ok: 'bg-[hsl(var(--ok)/.10)] text-foreground border-[hsl(var(--ok)/.35)]',
  }[tom];
  return <div className={cx('rounded-xl border px-3 py-2 text-[13px] leading-snug', t)}>{children}</div>;
}

export function Progresso({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> {texto}
    </div>
  );
}

export const moeda = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
