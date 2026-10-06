import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Loader2, MessageSquareText, NotebookPen, Paperclip, Radio, Star } from 'lucide-react';
import { LiveRoom } from '../../components/class-lesson/LessonBlocks';
import { lessonWhen } from '../../lib/classLessonPage';
import type { LessonNote, LessonStatus, LessonView, NoteKind } from '../../services/api/classLessons';
import { ApiError, SessionLost } from '../api';
import { lessonUrl } from '../config';
import { lessons } from '../lessons';
import ScoresCard from './ScoresCard';
import LiveCard from './LiveCard';
import NotesCard from './NotesCard';
import MaterialsCard from './MaterialsCard';

// The lesson page's rhythm: the room and «скоро → идёт» move a minute at a time.
const POLL_MS = 60_000;

const STATUS: Record<LessonStatus, { ru: string; en: string; tone: string }> = {
  upcoming: { ru: 'Скоро', en: 'Upcoming', tone: 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300' },
  live: { ru: 'Идёт сейчас', en: 'Live now', tone: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' },
  finished: { ru: 'Прошёл', en: 'Finished', tone: 'bg-muted text-muted-foreground' },
  cancelled: { ru: 'Отменён', en: 'Cancelled', tone: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300' },
};

export default function LessonPanel({ lessonId, onBack, onSessionLost }: {
  lessonId: number;
  onBack?: () => void;
  onSessionLost: () => void;
}) {
  const [view, setView] = useState<LessonView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The parent passes a fresh callback every render; reading it through a ref keeps `load` stable.
  const lost = useRef(onSessionLost);
  lost.current = onSessionLost;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setView(null); setError(null); }
    try {
      setView(await lessons.lesson(lessonId));
      setError(null);
    } catch (e) {
      if (e instanceof SessionLost) { lost.current(); return; }
      if (quiet) return;
      if (e instanceof ApiError && e.status === 403) setError('You have no access to this lesson.');
      else if (e instanceof ApiError && e.status === 404) setError('This lesson no longer exists.');
      else setError((e as Error).message || 'Could not load the lesson');
    }
  }, [lessonId]);

  useEffect(() => { void load(); }, [load]);

  const polling = view?.status === 'live' || view?.status === 'upcoming';
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, load]);

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-foreground">
        <p>{error}</p>
        <OpenInLms id={lessonId} label="Open in the LMS" />
      </div>
    );
  }
  if (!view) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
  const status = STATUS[view.status];
  const onNoteSaved = (kind: NoteKind, note: LessonNote | null) =>
    setView((prev) => (prev ? { ...prev, notes: { ...prev.notes, [kind]: note } } : prev));

  return (
    <div className="space-y-3">
      <header>
        {onBack && (
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" aria-hidden />{t('Назад', 'Back')}
          </button>
        )}
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 text-[15px] font-semibold leading-snug text-foreground">{view.title}</h1>
          <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>
            {view.status === 'live' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" />}
            {ru ? status.ru : status.en}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{lessonWhen(view.start, view.end, view.viewer.locale)}</p>
        {view.groups.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {view.groups.map((g) => (g.lesson_number ? `${g.name} · ${t('урок', 'lesson')} ${g.lesson_number}` : g.name)).join(', ')}
          </p>
        )}
        {view.topic && <p className="mt-1 text-xs text-foreground">{view.topic}</p>}
        <OpenInLms id={view.id} label={t('Открыть урок в LMS', 'Open lesson in LMS')} />
      </header>

      {view.live_lesson?.can_drive && (
        <Card title={t('Живой урок', 'Live lesson')} icon={<MessageSquareText className="h-4 w-4 text-brand" />}>
          <LiveCard lessonId={view.id} onSessionLost={() => lost.current()} />
        </Card>
      )}

      {view.live && (
        <Card title={t('Сейчас в уроке', 'In the room')} icon={<Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}>
          <LiveRoom view={view} />
        </Card>
      )}

      {view.register && view.status !== 'cancelled' && (
        <Card title={t('Баллы за урок', 'Activity scores')} icon={<Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />}>
          <ScoresCard view={view} onSaved={() => void load(true)} />
        </Card>
      )}

      <Card title={t('Заметки', 'Notes')} icon={<NotebookPen className="h-4 w-4 text-muted-foreground" />}>
        <NotesCard view={view} onSaved={onNoteSaved} />
      </Card>

      <Card title={t('Материалы', 'Materials')} icon={<Paperclip className="h-4 w-4 text-muted-foreground" />}>
        <MaterialsCard eventId={view.id} locale={view.viewer.locale} />
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">{icon}{title}</h2>
      {children}
    </section>
  );
}

function OpenInLms({ id, label }: { id: number; label: string }) {
  return (
    <a
      href={lessonUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-brand-subtle-foreground transition hover:bg-brand-subtle"
    >
      {label}<ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
