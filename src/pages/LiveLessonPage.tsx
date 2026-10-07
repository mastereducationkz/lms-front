import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Loader2, MonitorPlay } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StudentLive from '../components/live-lesson/StudentLive';
import { ConnectionNote } from '../components/live-lesson/connection';
import { useCountdown, useLiveLesson } from '../lib/liveLesson/useLiveLesson';
import { liveErrorText, withReconnect } from '../lib/liveLesson/resilience';
import type { CurrentLive } from '../lib/liveLesson/types';
import { live } from '../services/api/liveLesson';
import { connectSocket } from '../services/socket';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';

/**
 * `/live` (owner, 2026-09-29): the one link a teacher puts in the Meet chat. It opens whatever
 * lesson the signed-in student has on now, and shows the question the teacher opened in it.
 */
export default function LiveLessonPage() {
  const { user } = useAuth();
  const t = useT();
  const student = user?.role === 'student';
  const [current, setCurrent] = useState<CurrentLive | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    let alive = true;
    // A blip (a deploy) is waited out; only a lasting failure is said, in plain words.
    const find = () => withReconnect(() => live.current())
      .then((found) => { if (alive && found) { setCurrent(found); setFailed(null); } })
      .catch((e: unknown) => { if (alive) setFailed(liveErrorText(e)); });
    void find();
    // Opened before the lesson: pick it up as soon as it is on.
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') void find(); }, 30_000);
    return () => { alive = false; window.clearInterval(tick); };
  }, [student]);

  useEffect(() => { document.title = t('chatLive.live.title'); }, [t]);

  if (!student) {
    return (
      <Centered icon={<MonitorPlay className="h-8 w-8 text-muted-foreground" aria-hidden />} title={t('chatLive.live.page.forStudents')}>
        {t('chatLive.live.page.forStudentsHint')}
        <Link to="/calendar" className="mt-3 inline-block font-semibold text-primary underline underline-offset-2">{t('chatLive.live.page.openCalendar')}</Link>
      </Centered>
    );
  }
  if (failed && !current) return <Centered title={t('chatLive.live.page.openFailed')}>{failed}</Centered>;
  if (!current) return <Centered title={t('chatLive.live.page.finding')}><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Centered>;
  if (!current.lesson) {
    return (
      <Centered icon={<CalendarClock className="h-8 w-8 text-muted-foreground" aria-hidden />} title={t('chatLive.live.page.none')}>
        {t('chatLive.live.page.noneHint')}
      </Centered>
    );
  }
  return <LiveLesson eventId={current.lesson.id} title={current.lesson.title} />;
}

function LiveLesson({ eventId, title }: { eventId: number; title: string }) {
  const t = useT();
  const socket = useMemo(() => connectSocket(), []);
  const { state, error, now, act, reconnecting, syncedAt } = useLiveLesson({ eventId, api: live, socket, heartbeat: true });
  const seconds = useCountdown(state, now);
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-4">
      <h1 className="mb-3 text-lg font-semibold text-foreground">{state?.lesson.title ?? title}</h1>
      {!state && <ConnectionNote reconnecting={reconnecting} error={error} className="mb-2" />}
      {!state ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : state.mode === 'off' ? (
        <Centered title={t('chatLive.live.page.off')}>{t('chatLive.live.page.offHint')}</Centered>
      ) : (
        <StudentLive state={state} api={live} seconds={seconds} act={act} socket={socket} connection={{ reconnecting, error, syncedAt }} />
      )}
    </div>
  );
}

function Centered({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      {icon}
      <h1 className="mt-3 text-lg font-semibold text-foreground">{title}</h1>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
