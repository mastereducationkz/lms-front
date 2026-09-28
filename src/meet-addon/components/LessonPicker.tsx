import { CalendarClock, RefreshCw } from 'lucide-react';
import { lessonWhen } from '../../lib/classLessonPage';
import type { LessonBrief } from '../lessons';

/** Nothing runs in this Meet right now: offer the lesson before and the one after. */
export default function LessonPicker({ previous, next, onPick, onRefresh }: {
  previous: LessonBrief | null;
  next: LessonBrief | null;
  onPick: (id: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <CalendarClock className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
      <p className="mt-2 text-base font-semibold text-slate-900">No lesson in this Meet right now</p>
      <p className="mx-auto mt-1 max-w-[18rem] text-sm text-slate-600">
        The panel opens the lesson that runs in this Meet, from 30 minutes before it starts until 30 minutes after it ends.
      </p>
      <div className="mt-5 space-y-2 text-left">
        {previous && <Choice label="Previous lesson" lesson={previous} onPick={onPick} />}
        {next && <Choice label="Next lesson" lesson={next} onPick={onPick} />}
        {!previous && !next && (
          <p className="text-center text-xs text-slate-500">This Meet link belongs to no lesson you can open.</p>
        )}
      </div>
      <button type="button" onClick={onRefresh} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />Check again
      </button>
    </div>
  );
}

function Choice({ label, lesson, onPick }: { label: string; lesson: LessonBrief; onPick: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(lesson.id)}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
    >
      <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="block truncate text-sm font-semibold text-slate-900">{lesson.title}</span>
      <span className="block text-xs text-slate-600">{lessonWhen(lesson.start, lesson.end, 'en')}</span>
    </button>
  );
}
