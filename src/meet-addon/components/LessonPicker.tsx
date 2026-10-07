import { CalendarClock, RefreshCw } from 'lucide-react';
import { lessonWhen } from '../../lib/classLessonPage';
import type { LessonBrief } from '../lessons';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/classLesson';

/** Nothing runs in this Meet right now: offer the lesson before and the one after. */
export default function LessonPicker({ previous, next, onPick, onRefresh }: {
  previous: LessonBrief | null;
  next: LessonBrief | null;
  onPick: (id: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-2 text-base font-semibold text-foreground">{t('classLesson.addon.noLessonTitle')}</p>
      <p className="mx-auto mt-1 max-w-[18rem] text-sm text-muted-foreground">
        {t('classLesson.addon.noLessonBody')}
      </p>
      <div className="mt-5 space-y-2 text-left">
        {previous && <Choice label={t('classLesson.addon.previous')} lesson={previous} onPick={onPick} />}
        {next && <Choice label={t('classLesson.addon.next')} lesson={next} onPick={onPick} />}
        {!previous && !next && (
          <p className="text-center text-xs text-muted-foreground">{t('classLesson.addon.noneYours')}</p>
        )}
      </div>
      <button type="button" onClick={onRefresh} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />{t('classLesson.addon.checkAgain')}
      </button>
    </div>
  );
}

function Choice({ label, lesson, onPick }: { label: string; lesson: LessonBrief; onPick: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(lesson.id)}
      className="w-full rounded-xl border border-border px-3 py-2.5 text-left transition hover:border-brand hover:bg-brand-subtle/50"
    >
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="block truncate text-sm font-semibold text-foreground">{lesson.title}</span>
      <span className="block text-xs text-muted-foreground">{lessonWhen(lesson.start, lesson.end, 'en')}</span>
    </button>
  );
}
