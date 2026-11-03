import { AlertTriangle, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import type { TrainingState } from '@/services/api/staffTraining';
import '@/lib/i18n/catalogs/staffTraining';

const LOOK: Record<TrainingState, { icon: typeof Circle; tone: string }> = {
  done: { icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  in_progress: { icon: PlayCircle, tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  stuck: { icon: AlertTriangle, tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' },
  not_started: { icon: Circle, tone: 'bg-muted text-muted-foreground' },
};

/** done / in progress / stuck / not started: a word and an icon as well as a colour, so it reads without telling the colours apart. */
export default function StateChip({ state, className }: { state: TrainingState; className?: string }) {
  const t = useT();
  const known: TrainingState = state in LOOK ? state : 'not_started';
  const { icon: Icon, tone } = LOOK[known];
  return (
    <span data-state={known} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', tone, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(`staffTraining.state.${known}`)}
    </span>
  );
}
