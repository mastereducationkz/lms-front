import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BookOpenCheck, ClipboardList, NotebookPen, Radio, Send, Star, UsersRound } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import SectionCard from '../components/class-lesson/SectionCard';
import LessonHeader from '../components/class-lesson/LessonHeader';
import RegisterSection from '../components/class-lesson/RegisterSection';
import NotesSection from '../components/class-lesson/NotesSection';
import { HomeworkList, LiveRoom, MyMark, RequestsBlock } from '../components/class-lesson/LessonBlocks';
import ClassMaterialsSection from '../components/class-materials/ClassMaterialsSection';
import LessonRecordingSection from '../components/calendar/LessonRecordingSection';
import MeetAttendanceSection from '../components/calendar/MeetAttendanceSection';
import {
  asCalendarEvent, lessonWhen, sectionFromHash, sectionOrder, stampKz, type PageSection,
} from '../lib/classLessonPage';
import { lessonPath } from '../lib/lessonLinks';
import {
  getLesson, LessonLoadError, type LessonNote, type LessonView, type NoteKind,
} from '../services/api/classLessons';

// The live room and the move from «скоро» to «идёт» are a minute apart at most.
const POLL_MS = 60_000;

/**
 * One class lesson on one page — `/lessons/:id` (owner, 2026-09-28). Everything about the lesson in
 * the order that matters now: before it, what to bring; while it runs, who is in the room; after it,
 * the recording, the register and the recap. The backend shapes the answer for the viewer, so the
 * page never has to hide a classmate's mark or a staff note itself.
 */
export default function ClassLessonPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<LessonView | null>(null);
  const [error, setError] = useState<LessonLoadError | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrolledFor = useRef<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!eventId) return;
    if (!quiet) { setView(null); setError(null); }
    try {
      const data = await getLesson(eventId);
      setView(data);
      setError(null);
      if (String(data.id) !== eventId) {
        // A calendar's virtual lesson became a real one: keep one address per lesson.
        navigate(`${lessonPath(data.id)}${location.hash}`, { replace: true });
      }
    } catch (e) {
      if (!quiet) setError(e instanceof LessonLoadError ? e : new LessonLoadError(String(e), null));
    }
    // location.hash is read only to carry it over; a hash change must not reload the lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, navigate]);

  useEffect(() => { void load(); }, [load]);

  // Keep the chosen group when the lesson reloads; default to the first one.
  useEffect(() => {
    if (!view) return;
    setGroupId((prev) => (prev != null && view.groups.some((g) => g.id === prev) ? prev : view.groups[0]?.id ?? null));
  }, [view]);

  // «Войти» opens on the minute; the live room refreshes while the lesson is on (or about to be).
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
  const polling = view?.status === 'live' || view?.status === 'upcoming';
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, load]);

  useEffect(() => {
    if (!view) return;
    const g = view.groups.find((x) => x.id === groupId) ?? view.groups[0];
    document.title = `${g ? g.name : view.title} · ${lessonWhen(view.start, view.end, view.viewer.locale)}`;
  }, [view, groupId]);

  const sections = useMemo<PageSection[]>(() => (view ? sectionOrder(view.status, {
    viewer: view.viewer,
    hasRegister: Boolean(view.register),
    hasMe: Boolean(view.me),
    hasLive: Boolean(view.live),
    hasRequests: view.requests.length > 0 || Boolean(view.request_new_url),
    hasRecording: Boolean(view.recording),
    hasMeet: Boolean(view.meet_state && !['no_room', 'not_started'].includes(view.meet_state)),
  }) : []), [view]);

  const jump = useCallback((section: PageSection) => {
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${section}`);
  }, []);

  // A link to a section (#materials, #recording…) lands on it once the page is there.
  useEffect(() => {
    if (!view) return;
    const target = sectionFromHash(location.hash);
    const key = `${view.id}${location.hash}`;
    if (!target || scrolledFor.current === key) return;
    scrolledFor.current = key;
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }), 150);
  }, [view, location.hash]);

  const onNoteSaved = useCallback((kind: NoteKind, note: LessonNote | null) => {
    setView((prev) => (prev ? { ...prev, notes: { ...prev.notes, [kind]: note } } : prev));
  }, []);

  const event = useMemo(() => (view ? asCalendarEvent(view) : null), [view]);

  if (error) return <LoadFailure error={error} />;
  if (!view || !event) return <PageSkeleton />;

  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
  const group = view.groups.find((g) => g.id === groupId) ?? view.groups[0] ?? null;

  const render = (key: PageSection) => {
    switch (key) {
      case 'live':
        return (
          <SectionCard key={key} id="live" title={t('Сейчас в уроке', 'In the room now')} icon={<Radio className="h-4 w-4 text-emerald-600" aria-hidden />}>
            <LiveRoom view={view} />
          </SectionCard>
        );
      case 'me':
        return (
          <SectionCard key={key} id="me" title={t('Моя отметка', 'My mark')} icon={<Star className="h-4 w-4 text-yellow-500" aria-hidden />}>
            <MyMark view={view} />
          </SectionCard>
        );
      case 'materials':
        return (
          <SectionCard key={key} id="materials" embedded>
            <ClassMaterialsSection eventId={view.id} variant="dialog" />
          </SectionCard>
        );
      case 'recording':
        return (
          <SectionCard key={key} id="recording" embedded>
            <LessonRecordingSection event={event} />
          </SectionCard>
        );
      case 'register':
        return (
          <SectionCard key={key} id="register" title={t('Посещаемость и баллы', 'Attendance and scores')} icon={<UsersRound className="h-4 w-4 text-muted-foreground" aria-hidden />}>
            <RegisterSection view={view} groupId={group?.id ?? null} onSaved={() => void load(true)} />
          </SectionCard>
        );
      case 'homework':
        return (
          <SectionCard key={key} id="homework" title={t('Домашнее задание', 'Homework')} icon={<ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />}>
            <HomeworkList view={view} />
          </SectionCard>
        );
      case 'notes':
        return (
          <SectionCard key={key} id="notes" title={t('Заметки урока', 'Lesson notes')} icon={<NotebookPen className="h-4 w-4 text-muted-foreground" aria-hidden />}>
            <NotesSection view={view} onSaved={onNoteSaved} />
          </SectionCard>
        );
      case 'meet':
        return (
          <SectionCard key={key} id="meet" embedded>
            <MeetAttendanceSection event={event} role={view.viewer.role} />
          </SectionCard>
        );
      case 'requests':
        return (
          <SectionCard key={key} id="requests" title={t('Заявки по уроку', 'Lesson requests')} icon={<Send className="h-4 w-4 text-muted-foreground" aria-hidden />}>
            <RequestsBlock view={view} />
          </SectionCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <LessonHeader view={view} group={group} onGroup={setGroupId} sections={sections} onJump={jump} now={now} />
      <div className="mt-4 space-y-4">
        {view.cancelled && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <div>
              <p className="font-semibold">{t('Урок отменён', 'This lesson was cancelled')}</p>
              {view.cancelled.reason && <p className="mt-0.5">{view.cancelled.reason}</p>}
              {view.cancelled.replacement ? (
                <Link to={lessonPath(view.cancelled.replacement.id)} className="mt-1 inline-block font-semibold underline underline-offset-2">
                  {t('Перейти к уроку-замене', 'Go to the make-up lesson')} · {stampKz(view.cancelled.replacement.start, view.viewer.locale)}
                </Link>
              ) : (
                <p className="mt-0.5 text-rose-800/80 dark:text-rose-200/80">{t('Урока-замены нет.', 'There is no make-up lesson.')}</p>
              )}
            </div>
          </div>
        )}
        {view.me?.missed && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <BookOpenCheck className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <p>
              {t('Вы пропустили урок — посмотрите запись и материалы.', 'You missed this lesson — watch the recording and go through the materials.')}
              {' '}
              <button type="button" onClick={() => jump('recording')} className="font-semibold underline underline-offset-2">{t('К записи', 'To the recording')}</button>
            </p>
          </div>
        )}
        {sections.map(render)}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 sm:px-6" aria-busy="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
    </div>
  );
}

function LoadFailure({ error }: { error: LessonLoadError }) {
  const text = error.status === 404
    ? ['Урок не найден', 'Возможно, его удалили или ссылка неверная.']
    : error.status === 403
      ? ['Нет доступа к уроку', 'Этот урок не относится к вашим группам.']
      : ['Не удалось открыть урок', error.message || 'Попробуйте обновить страницу.'];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-foreground">{text[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{text[1]}</p>
      <Link to="/calendar" className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
        Календарь / Calendar
      </Link>
    </div>
  );
}
