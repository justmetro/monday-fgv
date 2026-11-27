import { useState, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Loader2, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
export function Botao({ variante = 'secundario', carregando, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const v = {
    primario: 'bg-foreground text-background hover:opacity-85 shadow-[0_1px_2px_rgba(0,0,0,.18)]',
    secundario: 'bg-secondary text-secondary-foreground hover:bg-muted',
    fantasma: 'text-foreground hover:bg-muted',
    perigo: 'bg-destructive text-destructive-foreground hover:opacity-90',
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 h-8 text-[13px] font-medium transition-[opacity,background-color,transform] duration-150 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none', v, className)}>
      {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-card text-card-foreground border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,.03),0_8px_24px_-12px_rgba(0,0,0,.08)]', className)}>{children}</div>;
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

/** Número grande com rótulo pequeno (estilo iOS). */
export function Numero({ rotulo, valor, tom, detalhe }: { rotulo: string; valor: ReactNode; tom?: 'ok' | 'aviso'; detalhe?: ReactNode }) {
  const c = tom === 'ok' ? 'text-[hsl(var(--ok))]' : tom === 'aviso' ? 'text-[hsl(var(--warn))]' : '';
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2 min-w-[110px]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={cx('mt-0.5 text-[20px] font-semibold leading-tight num', c)}>{valor}</div>
      {detalhe && <div className="text-[11.5px] text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

/** Estado de abrir/recolher itens de uma lista. Começa tudo recolhido. */
export function useRecolher() {
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  return {
    aberto: (k: string | number) => abertos.has(String(k)),
    alternar: (k: string | number) => setAbertos((s) => { const n = new Set(s); const c = String(k); if (n.has(c)) n.delete(c); else n.add(c); return n; }),
    abrirTodos: (ks: (string | number)[]) => setAbertos(new Set(ks.map(String))),
    recolherTodos: () => setAbertos(new Set()),
    qtd: abertos.size,
  };
}

/** Linha de controle de uma lista: contagem e expandir/recolher todos. */
export function BarraLista({ total, abertos, onAbrir, onRecolher, children }: { total: number; abertos: number; onAbrir: () => void; onRecolher: () => void; children?: ReactNode }) {
  const tudo = total > 0 && abertos >= total;
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <span className="num">{total}</span> {total === 1 ? 'item' : 'itens'}{abertos ? <span>· <span className="num">{abertos}</span> aberto{abertos > 1 ? 's' : ''}</span> : null}
      <div className="flex-1" />
      {children}
      <button onClick={tudo ? onRecolher : onAbrir} className="inline-flex items-center gap-1 rounded-full px-2.5 h-7 bg-muted hover:bg-secondary text-foreground transition-colors">
        {tudo ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}{tudo ? 'Recolher todos' : 'Expandir todos'}
      </button>
    </div>
  );
}

/** Item de lista que abre e recolhe. O corpo só é montado depois da primeira abertura. */
export function ItemRecolhivel({ aberto, onAlternar, cabecalho, resumo, inativo, children, className }: {
  aberto: boolean; onAlternar: () => void; cabecalho: ReactNode; resumo?: ReactNode; inativo?: boolean; children: ReactNode; className?: string;
}) {
  const [visto, setVisto] = useState(aberto);
  if (aberto && !visto) setVisto(true);
  return (
    <div className={cx('item-lista rounded-xl border border-border/60 bg-card transition-[opacity,border-color] duration-200', aberto && 'border-border shadow-[0_6px_20px_-14px_rgba(0,0,0,.25)]', inativo && 'opacity-50', className)}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={onAlternar}>
        <div className="min-w-0 flex-1 flex items-center gap-2">{cabecalho}</div>
        {!aberto && resumo && <div className="hidden md:flex items-center gap-1.5 shrink-0">{resumo}</div>}
        <button type="button" aria-expanded={aberto} aria-label={aberto ? 'Recolher' : 'Expandir'} onClick={(e) => { e.stopPropagation(); onAlternar(); }}
          className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted shrink-0">
          <ChevronDown className={cx('h-4 w-4 transition-transform duration-200', aberto && 'rotate-180')} />
        </button>
      </div>
      <div className={cx('recolhe', aberto && 'aberto')}>
        <div className="min-h-0 overflow-hidden">{visto && <div className="px-3 pb-3 pt-1">{children}</div>}</div>
      </div>
    </div>
  );
}

/** Impede que cliques em controles do cabeçalho abram/recolham o item. */
export const naoAlterna = { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() };
