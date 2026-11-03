import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/staffTraining';

/** The frame every training page shares: one column that sizes itself by its own width (container queries), not the window's. */
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="@container mx-auto w-full max-w-5xl space-y-6">{children}</div>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

export function Loading() {
  const t = useT();
  return (
    <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {t('staffTraining.loading')}
    </p>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="bg-background text-foreground">{t('staffTraining.retry')}</Button>
    </div>
  );
}
