import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Link2, Loader2, Timer, User, Users, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import HlsVideoPlayer from '../HlsVideoPlayer';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { getLessonRecording, type LessonRecording } from '../../services/api/recordings';
import { getMeetRecord } from '../../services/api/meetAttendance';
import { toParticipantsView, type ParticipantsView } from '../../lib/meetAttendance';
import { ParticipantsPanel } from '../meetAttendance/ParticipantsPanel';
import { useAuth } from '../../contexts/AuthContext';
import {
  almatyDayKey, dayHeading, formatDurationWords, splitLessonTitle, timeRange, type Locale,
} from '../../lib/recordings';

/** What the dialog shows about the lesson before (and while) the video loads. */
export interface RecordingMeta {
  eventId: number;
  title: string;
  /** Absent only for a deep link whose lesson details could not be loaded. */
  start?: string | null;
  end?: string | null;
  groups?: { name: string }[] | null;
  teacher?: string | null;
  durationSeconds?: number | null;
}

interface Props {
  meta: RecordingMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: Locale;
}

const TEXT = {
  en: {
    loading: 'Loading the recording…',
    pending: 'This recording is still being processed. It will appear here shortly.',
    failed: 'This recording could not be processed.',
    removed: 'This recording is no longer available.',
    missing: 'There is no recording for this lesson.',
    error: 'The recording could not be loaded. Please try again.',
    copy: 'Copy link',
    copied: 'Link copied',
    copyFailed: 'Could not copy the link',
  },
  ru: {
    loading: 'Загружаем запись…',
    pending: 'Запись ещё обрабатывается и скоро появится здесь.',
    failed: 'Не удалось обработать эту запись.',
    removed: 'Эта запись больше недоступна.',
    missing: 'Для этого урока нет записи.',
    error: 'Не удалось загрузить запись. Попробуйте ещё раз.',
    copy: 'Скопировать ссылку',
    copied: 'Ссылка скопирована',
    copyFailed: 'Не удалось скопировать ссылку',
  },
} as const;

/**
 * One lesson recording, large. Shared by the calendar's day list and the Recordings library.
 *
 * The playback link is fetched when the dialog opens, never earlier: it carries a token
 * minted for this viewer that expires, so nothing upstream may hold on to one. The video
 * starts on its own — the viewer opened this dialog in order to watch.
 */
/** Who may see the class beside a recording — the Meet record's readers; students never. */
const RECORD_ROLES = new Set(['admin', 'head_curator', 'head_teacher', 'teacher', 'curator']);

export default function RecordingPlayerDialog({ meta, open, onOpenChange, locale = 'en' }: Props) {
  const t = TEXT[locale];
  const { user } = useAuth();
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [participants, setParticipants] = useState<ParticipantsView | null>(null);
  const seesParticipants = RECORD_ROLES.has(user?.role ?? '');

  const eventId = meta?.eventId;
  useEffect(() => {
    setRecording(null);
    setFailedToLoad(false);
    if (!open || !eventId) return;
    let cancelled = false;
    getLessonRecording(eventId)
      .then((data) => !cancelled && setRecording(data))
      .catch(() => !cancelled && setFailedToLoad(true));
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  // The class beside the video, for staff. A 404 (not this viewer's lesson) shows nothing.
  useEffect(() => {
    setParticipants(null);
    if (!open || !eventId || !seesParticipants) return;
    let cancelled = false;
    getMeetRecord(eventId)
      .then((record) => !cancelled && setParticipants(record ? toParticipantsView(record) : null))
      .catch(() => { /* the video still plays; the list is a companion, not a requirement */ });
    return () => {
      cancelled = true;
    };
  }, [open, eventId, seesParticipants]);

  if (!meta) return null;

  const { name, lesson } = splitLessonTitle(meta.title, meta.groups, locale);
  const duration = formatDurationWords(recording?.duration_seconds ?? meta.durationSeconds, locale);
  const date = meta.start ? dayHeading(almatyDayKey(meta.start), new Date(), locale) : null;
  const groupNames = (meta.groups ?? []).map((g) => g.name).join(', ');

  const copyLink = async () => {
    const link = `${window.location.origin}/recordings?watch=${meta.eventId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  const message = failedToLoad
    ? t.error
    : recording && recording.status !== 'ready'
      ? t[recording.status]
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="flex items-start gap-3 px-5 pb-3 pt-4 pr-12 sm:px-6">
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-bold leading-snug sm:text-xl">{name}</DialogTitle>
            {lesson && <p className="mt-0.5 text-sm font-medium text-muted-foreground">{lesson}</p>}
          </div>
        </div>

        <div className="relative w-full bg-black">
          {recording?.status === 'ready' && recording.url ? (
            <HlsVideoPlayer
              key={recording.url}
              url={recording.url}
              poster={recording.poster_url}
              title={meta.title}
              autoPlay
              className="!rounded-none"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/75">
              {message ? (
                <>
                  <VideoOff className="h-8 w-8 text-white/45" aria-hidden />
                  <p className="max-w-sm">{message}</p>
                </>
              ) : (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-white/60" aria-hidden />
                  <p>{t.loading}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <DialogDescription asChild>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
              {date && (
                <li className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {date}
                </li>
              )}
              {meta.start && meta.end && (
                <li className="flex items-center gap-1.5 tabular-nums">
                  <Clock className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {timeRange(meta.start, meta.end)}
                </li>
              )}
              {duration && (
                <li className="flex items-center gap-1.5 tabular-nums">
                  <Timer className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {duration}
                </li>
              )}
              {groupNames && (
                <li className="flex min-w-0 items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 flex-none" aria-hidden />
                  <span className="truncate">{groupNames}</span>
                </li>
              )}
              {meta.teacher && (
                <li className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {meta.teacher}
                </li>
              )}
            </ul>
          </DialogDescription>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex flex-none items-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {t.copy}
          </button>
        </div>
        {participants && (
          <div className="px-5 pb-5 sm:px-6">
            <ParticipantsPanel view={participants} locale={locale} />
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
