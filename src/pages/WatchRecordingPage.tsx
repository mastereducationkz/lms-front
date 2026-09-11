import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Loader2, Users, Video } from 'lucide-react';
import HlsVideoPlayer from '../components/HlsVideoPlayer';
import logoIco from '../assets/masteredlogo-ico.ico';
import { APP_TIMEZONE } from '../lib/datetime';
import { formatClock } from '../lib/recordings';
import { ParticipantsPanel } from '../components/meetAttendance/ParticipantsPanel';
import { TalkCard } from '../components/meetAttendance/TalkPanel';
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
 */
export default function WatchRecordingPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

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

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
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

        {state.kind === 'ready' && (
          <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <HlsVideoPlayer
              url={state.data.url}
              poster={state.data.poster_url}
              title={state.data.title}
              className="aspect-video w-full bg-black"
            />
            <div className="space-y-2 px-5 py-4 sm:px-6">
              <h1 className="text-lg font-bold leading-snug text-foreground sm:text-xl">{state.data.title}</h1>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                {state.data.start && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden />
                    {almaty(state.data.start, { weekday: 'long', day: 'numeric', month: 'long' })},{' '}
                    {almaty(state.data.start, { hour: '2-digit', minute: '2-digit' })}–{almaty(state.data.end, { hour: '2-digit', minute: '2-digit' })} (Алматы)
                  </span>
                )}
                {state.data.teacher && <span>Преподаватель: {state.data.teacher}</span>}
                {state.data.groups.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden />{state.data.groups.join(', ')}
                  </span>
                )}
                {formatClock(state.data.duration_seconds) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Video className="h-4 w-4" aria-hidden />{formatClock(state.data.duration_seconds)}
                  </span>
                )}
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Ссылка действует до {almaty(state.data.expires_at, { hour: '2-digit', minute: '2-digit' })} (Алматы).
                Чтобы посмотреть позже, откройте запись заново из CRM.
              </p>
            </div>
          </article>
        )}

        {state.kind === 'ready' && state.data.participants && (
          <ParticipantsPanel view={state.data.participants} locale="ru" className="mt-4 shadow-sm" />
        )}
        {/* Who spoke and for how long — no transcript here: students' words stay inside the LMS. */}
        {state.kind === 'ready' && state.data.participants?.talk && state.data.start && state.data.end && (
          <TalkCard
            talk={publicTalkRecord(state.data.participants.talk, { title: state.data.title, start: state.data.start, end: state.data.end })}
            variant="public"
            locale="ru"
            className="mt-4 shadow-sm"
          />
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
