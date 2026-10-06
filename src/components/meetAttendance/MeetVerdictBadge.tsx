import { Check, Pencil, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { verdictHint, verdictText } from '../../lib/meetAttendance';
import type { MeetStudentVerdict } from '../../services/api/meetAttendance';
import { registerNote } from '../../lib/meetRegister';
import type { StudentRegister } from '../../services/api/meetRegister';

const TONE: Record<string, string> = {
  present: 'text-emerald-700 dark:text-emerald-300',
  late: 'text-amber-700 dark:text-amber-300',
  absent: 'text-rose-700 dark:text-rose-300',
  unknown: 'text-muted-foreground',
};

/** Drawn marks, not ✓/✗ glyphs; «unknown» stays a «?» character. */
const MARK: Record<string, LucideIcon> = { present: Check, absent: X };

/** The journal cell's hover line: what Meet says about this student in this lesson. */
export function verdictNote(verdict: MeetStudentVerdict | undefined, locale: 'en' | 'ru'): string | null {
  return verdict ? [`Meet: ${verdictText(verdict, locale)}`, verdictHint(verdict, locale)].filter(Boolean).join('\n') : null;
}

/**
 * Meet's verdict in a corner of an attendance journal cell (owner, 2026-09-16): «Meet ✓», «Meet 12′»
 * (late by), «Meet ✗», «Meet ?» (an account in the room isn't confirmed). Underlined when Meet wrote
 * the mark itself; ✎ when a person changed it after Meet.
 */
export function MeetVerdictBadge({ verdict, locale, className, register }: { verdict: MeetStudentVerdict; locale: 'en' | 'ru'; className?: string; register?: StudentRegister }) {
  // Held back, the badge shows what the confirmed accounts say, with a «?» (see verdictText).
  const shown = verdict.verdict ?? verdict.provisional ?? null;
  const key = verdict.verdict ?? 'unknown';
  const Mark = shown && shown !== 'late' ? MARK[shown] : undefined;
  const face = shown === 'late' ? `${verdict.late_minutes}′` : Mark ? null : '?';
  const provisional = verdict.verdict || !shown ? '' : '?';
  // Since 2026-09-23 Meet may have written this mark itself: then the badge is Meet's mark, not a note beside it.
  const byMeet = register?.mode === 'live' && register.state === 'written';
  const changed = register?.state === 'override';
  const title = [verdictNote(verdict, locale), registerNote(register, locale)].filter(Boolean).join('\n') || undefined;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'pointer-events-auto absolute bottom-0 left-0 inline-flex items-center gap-px rounded-tr bg-white/90 px-1 text-[9px] font-semibold leading-3 dark:bg-card/90',
        TONE[key],
        byMeet && 'font-extrabold underline decoration-dotted underline-offset-2',
        className,
      )}
    >
      Meet{' '}
      {Mark ? <Mark className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" /> : face}
      {provisional}
      {changed && <Pencil className="ml-0.5 h-2 w-2" strokeWidth={3} aria-hidden="true" />}
    </span>
  );
}

export default MeetVerdictBadge;
