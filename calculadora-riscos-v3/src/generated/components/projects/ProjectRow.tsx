import { Link } from '@/router';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { getProjects } from '@generated/data/projects';
import { Skeleton } from '@components/ui/skeleton';
import { calcTone, envioTone, Pill } from '@generated/components/kit';
import { formatDate } from '@generated/lib/config';

type Project = Awaited<ReturnType<typeof getProjects>>['items'][number];

export function parseGrs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function warningLines(log: string | null | undefined): string[] {
  return (log ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^aviso/i.test(l) || /\baviso\b/i.test(l));
}

export function ProjectRow({ project: p }: { project: Project }) {
  const grs = parseGrs(p.grsIdentificados);
  const avisos = warningLines(p.logAvisosDoMotor);
  return (
    <li className="border-b border-[hsl(var(--border)/0.7)] last:border-b-0">
      <Link
        to="/projetos/$id"
        params={{ id: p.id }}
        className="group grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-[hsl(var(--accent)/0.45)] focus-visible:bg-[hsl(var(--accent)/0.45)] focus-visible:outline-none lg:grid-cols-[minmax(0,2.2fr)_150px_90px_minmax(0,1.6fr)_minmax(0,1.8fr)_130px] lg:items-center lg:gap-4"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-[hsl(var(--sky))]" title={p.name}>
            {p.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Última execução {formatDate(p.dataDaLtimaExecuo)}
            {p.versoMetodologia ? ` · ${p.versoMetodologia}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:block">
          <span className="mono-label text-[hsl(var(--text-dim))] lg:hidden">Calculadora</span>
          <Pill tone={calcTone(p.calculadora)}>{p.calculadora ?? 'Sem status'}</Pill>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mono-label text-[hsl(var(--text-dim))] lg:hidden">Riscos</span>
          <span className="mono text-xl tabular-nums text-foreground">{p.riscosGerados ?? '—'}</span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1" title={grs.join('; ')}>
          {grs.length === 0 && <span className="text-xs text-muted-foreground">Nenhum GR identificado</span>}
          {grs.slice(0, 5).map((g) => (
            <span key={g} className="mono rounded-sm border border-[hsl(var(--border))] px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {g}
            </span>
          ))}
          {grs.length > 5 && <span className="mono px-1 text-[11px] text-[hsl(var(--sky))]">+{grs.length - 5}</span>}
        </div>
        <div className="min-w-0">
          {avisos.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--warning))]" title={avisos.join('\n')}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                {avisos.length > 1 ? `${avisos.length} avisos · ` : ''}
                {avisos[0]}
              </span>
            </p>
          ) : (
            <p className="line-clamp-2 text-xs text-muted-foreground" title={p.logAvisosDoMotor ?? ''}>
              {p.logAvisosDoMotor ? 'Sem avisos na última execução' : 'Sem registro do motor'}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Pill tone={envioTone(p.envioAoPlanejamento)}>{p.envioAoPlanejamento ?? 'Não enviado'}</Pill>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--sky))]" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

export function ProjectRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-[hsl(var(--border)/0.7)] px-5 py-4 lg:grid-cols-[minmax(0,2.2fr)_150px_90px_minmax(0,1.6fr)_minmax(0,1.8fr)_130px] lg:gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-28 rounded-full" />
      <Skeleton className="h-6 w-10" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
  );
}
