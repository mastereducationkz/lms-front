import type { ReactNode } from 'react';
import { Archive, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface HomeworkCardItem {
  id: number;
  title: string;
  description?: string;
  status?: string;
  score?: number;
  max_score?: number;
  due_date?: string;
  extended_deadline?: string;
  event_start_datetime?: string;
  is_previous?: boolean;
  previous_group_name?: string;
}

interface Props<T extends HomeworkCardItem> {
  items: T[];
  renderStatus: (item: T) => ReactNode;
  formatDate: (value?: string) => string;
  isOverdue: (value: string) => boolean;
  onOpen: (id: number) => void;
  className?: string;
}

/**
 * The student's homework list where the table can't fit (a phone, Telegram's in-app browser):
 * one card per homework with the same facts as a table row — title, status, due date, grade and
 * the one action — so nothing sits behind a sideways scroll.
 */
export default function StudentHomeworkCards<T extends HomeworkCardItem>({ items, renderStatus, formatDate, isOverdue, onOpen, className }: Props<T>) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((a) => {
        const due = a.extended_deadline ?? a.due_date ?? a.event_start_datetime;
        const late = !a.extended_deadline && a.due_date && a.status === 'not_submitted' && isOverdue(a.due_date);
        const done = a.status === 'graded' || a.status === 'submitted';
        return (
          <li key={a.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpen(a.id)} className="min-w-0 text-left font-medium text-foreground hover:text-brand">
                {a.title}
              </button>
              <span className="shrink-0">{renderStatus(a)}</span>
            </div>
            {a.is_previous && a.previous_group_name && (
              <span className="mt-1 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Archive className="h-3 w-3" aria-hidden />
                {a.previous_group_name}
              </span>
            )}
            {a.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <span className={cn(
                'inline-flex min-w-0 items-center gap-1.5',
                a.extended_deadline ? 'text-green-600 dark:text-green-400' : late ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
              )}>
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{due ? formatDate(due) : '-'}</span>
                {a.extended_deadline && <span className="text-[10px] font-bold uppercase">Ext</span>}
              </span>
              <span className="flex items-center gap-3">
                {a.status === 'graded' && (
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {a.score}/{a.max_score ?? 100}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {Math.round(((a.score || 0) / (a.max_score || 100)) * 100)}%
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-brand hover:bg-brand-surface"
                >
                  {done ? 'View' : 'Submit'}
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
