import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OWED_PREVIEW, owedLink, previewOwed } from '../../lib/attendanceOwed';
import { stampKz } from '../../lib/classLessonPage';
import { useLocale, useT } from '../../lib/i18n/react';
import type { OwedItem } from '../../services/api/attendanceOwed';
import '@/lib/i18n/catalogs/attendance';

/**
 * «Ждёт вас» on /attendance: the lessons that ran and still need the teacher — a register Meet could not
 * take, or activity scores — oldest first, each opening its lesson page (also for a group that has since
 * finished). Nothing owed, nothing shown.
 */
export function OwedLessonsList({ items }: { items: OwedItem[] }) {
  const t = useT();
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = previewOwed(items, expanded);

  return (
    <section className="mb-4 rounded-lg border border-border bg-card" aria-label={t('attendance.owed.title')}>
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('attendance.owed.title')} · {items.length}
      </h2>
      <ul className="divide-y divide-border">
        {shown.map((item) => (
          <li key={`${item.kind}:${item.event_id}`}>
            <Link to={owedLink(item)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm transition hover:bg-muted/60">
              <span className="min-w-0 flex-1 basis-48 truncate font-medium text-foreground">
                {item.group_name}
                <span className="font-normal text-muted-foreground"> · {stampKz(item.start, locale)}</span>
              </span>
              <span className={cn(
                'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                item.kind === 'register'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
              )}>
                {t(item.kind === 'register' ? 'attendance.owed.kindRegister' : 'attendance.owed.kindScores')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(item.kind === 'register' ? 'attendance.owed.register' : 'attendance.owed.scores', { count: item.missing })}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > OWED_PREVIEW && (
        <button type="button" onClick={() => setExpanded((open) => !open)}
          className="w-full border-t border-border px-3 py-1.5 text-center text-xs font-semibold text-brand hover:bg-muted/60">
          {expanded ? t('attendance.owed.showLess') : t('attendance.owed.showAll', { count: items.length })}
        </button>
      )}
    </section>
  );
}

export default OwedLessonsList;
