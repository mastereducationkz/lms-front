import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Loader2, Users, Video } from 'lucide-react';
import HlsVideoPlayer from '../components/HlsVideoPlayer';
import logoIco from '../assets/masteredlogo-ico.ico';
import { APP_TIMEZONE } from '../lib/datetime';
import { formatClock } from '../lib/recordings';
import { ParticipantsPanel } from '../components/meetAttendance/ParticipantsPanel';
import { TalkSidePanel } from '../components/meetAttendance/TalkSidePanel';
import { useVideoClock } from '../components/recordings/useVideoClock';
import { cn } from '../lib/utils';
import type { ParticipantsView } from '../lib/meetAttendance';
import { publicTalkRecord } from '../lib/meetTalk';
import type { PublicTalk } from '../services/api/meetTalk';

interface WatchPayload {
  title: string;
  start: string | null;
  end: string | null;
  teacher: string | null;
  groups: string[];
  duration_seconds: number | null;
  url: string;
  poster_url: string | null;
  expires_at: string;
  /** The lesson's class — who was in the room, and everyone expected — as the server allows it. */
  participants?: (ParticipantsView & { talk?: PublicTalk | null }) | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: WatchPayload }
  | { kind: 'expired' }
  | { kind: 'missing' }
  | { kind: 'error' };

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function almaty(iso: string | null, options: Intl.DateTimeFormatOptions): string {
  return iso ? new Date(iso).toLocaleString('ru-RU', { ...options, timeZone: APP_TIMEZONE }) : '';
}

/**
 * One lesson's recording, opened from the CRM with a watch link — no LMS account, no login.
 *
 * The key in the URL is the permission: it opens this lesson only and lasts three hours (the
 * CRM makes a new one on every click). Plain `fetch`, not the app's API client: nobody here is
 * signed in, and the client's session handling has nothing to do for a visitor like this.
 *
 * Laid out like the LMS player (owner, 2026-09-11): on a wide screen the video, its details and the
 * class on the left, and who spoke when on the right, following the video — never the words.
 */
export default function WatchRecordingPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const playerBox = useRef<HTMLDivElement>(null);
  const data = state.kind === 'ready' ? state.data : null;
  const talk = useMemo(() => {
    const raw = data?.participants?.talk;
    if (!raw || raw.state !== 'ready' || !data?.start || !data.end) return null;
    return publicTalkRecord(raw, { title: data.title, start: data.start, end: data.end });
  }, [data]);
  const { time, seek } = useVideoClock(playerBox, Boolean(talk));

  useEffect(() => {
    let cancelled = false;
    fetch(`${backendUrl}/watch-links/${encodeURIComponent(token)}`, { credentials: 'omit' })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 410) return setState({ kind: 'expired' });
        if (response.status === 404) return setState({ kind: 'missing' });
        if (!response.ok) return setState({ kind: 'error' });
        setState({ kind: 'ready', data: (await response.json()) as WatchPayload });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    document.title = state.kind === 'ready' ? `Запись урока — ${state.data.title}` : 'Запись урока | Master Education';
  }, [state]);

  const video = data && (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div ref={playerBox}>
        <HlsVideoPlayer
          url={data.url}
          poster={data.poster_url}
          title={data.title}
          className="aspect-video w-full bg-black !rounded-none"
        />
      </div>
      <div className="space-y-2 px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold leading-snug text-foreground sm:text-xl">{data.title}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          {data.start && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              {almaty(data.start, { weekday: 'long', day: 'numeric', month: 'long' })},{' '}
              {almaty(data.start, { hour: '2-digit', minute: '2-digit' })}–{almaty(data.end, { hour: '2-digit', minute: '2-digit' })} (Алматы)
            </span>
          )}
          {data.teacher && <span>Преподаватель: {data.teacher}</span>}
          {data.groups.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden />{data.groups.join(', ')}
            </span>
          )}
          {formatClock(data.duration_seconds) && (
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-4 w-4" aria-hidden />{formatClock(data.duration_seconds)}
            </span>
          )}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          Ссылка действует до {almaty(data.expires_at, { hour: '2-digit', minute: '2-digit' })} (Алматы).
          Чтобы посмотреть позже, откройте запись заново из CRM.
        </p>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className={cn('mx-auto w-full', talk ? 'max-w-[1400px]' : 'max-w-4xl')}>
        <div className="mb-5 flex items-center gap-2.5">
          <img src={logoIco} alt="" className="h-7 w-7 rounded" />
          <span className="text-sm font-semibold text-foreground">Master Education</span>
          <span className="text-sm text-muted-foreground">· Запись урока</span>
        </div>

        {state.kind === 'loading' && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Открываем запись…
          </div>
        )}

        {state.kind === 'expired' && (
          <Notice title="Ссылка устарела">
            Ссылка на запись действует три часа. Откройте запись заново из CRM — появится новая ссылка.
          </Notice>
        )}
        {state.kind === 'missing' && (
          <Notice title="Запись не найдена">
            Ссылка неверная, или запись этого урока больше недоступна. Откройте её заново из CRM.
          </Notice>
        )}
        {state.kind === 'error' && (
          <Notice title="Не удалось открыть запись">Проверьте соединение и обновите страницу.</Notice>
        )}

        {data && (
          /* Wide: video and class on the left, who spoke on the right, following the video. Narrow:
             video, then who spoke, then the class. The DOM keeps that narrow order. */
          <div className={cn('grid items-start gap-4', talk && 'lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]')}>
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">{video}</div>
            {/* Who spoke and for how long — no transcript here: students' words stay inside the LMS. */}
            {talk && (
              <aside className="min-w-0 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100vh-2rem)]">
                <TalkSidePanel
                  talk={talk}
                  locale="ru"
                  variant="public"
                  playhead={time}
                  onSeek={seek}
                  layout="side"
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:h-full"
                />
              </aside>
            )}
            {data.participants && (
              <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                <ParticipantsPanel view={data.participants} locale="ru" defaultOpen className="shadow-sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
