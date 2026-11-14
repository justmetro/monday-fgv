import { Link } from '@tanstack/react-router';
import { AlertCircle, DatabaseZap } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';

export function NoProjects() {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <DatabaseZap className="mx-auto size-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold">Nenhum projeto importado ainda</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Importe o primeiro quadro de projeto para começar. O painel usa apenas os dados salvos a partir dos quadros da Monday.
      </p>
      <Link to="/importacao" className="mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
        Realizar a primeira importação
      </Link>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-[hsl(var(--bad-soft))] p-3 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="min-h-9 rounded-md border border-destructive/40 px-3 text-xs font-medium">Tentar novamente</button>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}
