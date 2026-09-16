import { cn } from '../../lib/utils';
import { verdictText } from '../../lib/meetAttendance';
import type { MeetStudentVerdict } from '../../services/api/meetAttendance';

const TONE: Record<string, string> = {
  present: 'text-emerald-700 dark:text-emerald-300',
  late: 'text-amber-700 dark:text-amber-300',
  absent: 'text-rose-700 dark:text-rose-300',
  unknown: 'text-gray-500 dark:text-gray-400',
};

const MARK: Record<string, string> = { present: '✓', absent: '✗', unknown: '?' };

/** The journal cell's hover line: what Meet says about this student in this lesson. */
export function verdictNote(verdict: MeetStudentVerdict | undefined, locale: 'en' | 'ru'): string | null {
  return verdict ? `Meet: ${verdictText(verdict, locale)}` : null;
}

/**
 * Meet's verdict in a corner of an attendance journal cell (owner, 2026-09-16): «Meet ✓», «Meet 12′»
 * (late by), «Meet ✗», «Meet ?» (an account in the room isn't confirmed). Beside the mark, never
 * instead of it — the teacher still decides.
 */
export function MeetVerdictBadge({ verdict, locale, className }: { verdict: MeetStudentVerdict; locale: 'en' | 'ru'; className?: string }) {
  const key = verdict.verdict ?? 'unknown';
  const face = verdict.verdict === 'late' ? `${verdict.late_minutes}′` : MARK[key];
  const title = verdictNote(verdict, locale) ?? undefined;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'pointer-events-auto absolute bottom-0 left-0 rounded-tr bg-white/90 px-1 text-[9px] font-semibold leading-3 dark:bg-card/90',
        TONE[key],
        className,
      )}
    >
      Meet {face}
    </span>
  );
}

export default MeetVerdictBadge;
