import { Clock, ExternalLink, MapPin, Video, Users } from 'lucide-react';
import { openPlatformPage, parsePlatformUrl } from '../../lib/platformLinks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Event, LessonRequest } from '../../types';
import { cx, formatTime, eventStyle, typeLabel, isSubstitutedForTeacher } from './calendarUtils';

export type RequestType = 'substitution' | 'reschedule' | 'cancel';

interface Props {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id?: number | string; role?: string } | null | undefined;
  myRequests: Map<number, LessonRequest>;
  onRequest: (type: RequestType, event: Event) => void;
}

export default function EventDetailDialog({ event, open, onOpenChange, user, myRequests, onRequest }: Props) {
  if (!event) return null;
  // Auto-managed weekly-test events link to the set page on the platform: open it signed in.
  const platformLink = event.event_type === 'weekly_test' ? parsePlatformUrl(event.meeting_url) : null;
  const s = eventStyle(event);
  const sub = isSubstitutedForTeacher(event, user);
  const dateLabel = new Date(event.start_datetime).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const canAct =
    (user?.role === 'teacher' || user?.role === 'admin') &&
    event.event_type === 'class' &&
    !sub &&
    !event.is_substitution &&
    !!event.group_ids?.length;
  const existing = myRequests.get(event.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className={cx('h-1 flex-none', s.dot)} />
        <div className="overflow-y-auto p-6">
          <DialogHeader className="space-y-1">
            <div className={cx('text-[11px] font-bold uppercase tracking-wider', s.time)}>
              {typeLabel(event.event_type)}
              {sub && ' · Substituted'}
            </div>
            <DialogTitle className="text-lg font-bold leading-snug">{event.title}</DialogTitle>
          </DialogHeader>

          {event.description && (
            <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
          )}

          <div className="mt-4 flex flex-col gap-2.5 text-sm">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 flex-none text-muted-foreground/70" />
              <span>
                {event.event_type === 'assignment'
                  ? `Due ${formatTime(event.start_datetime)} · ${dateLabel}`
                  : `${formatTime(event.start_datetime)} – ${formatTime(event.end_datetime)} · ${dateLabel}`}
              </span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2.5">
                {event.is_online ? (
                  <Video className="h-4 w-4 flex-none text-muted-foreground/70" />
                ) : (
                  <MapPin className="h-4 w-4 flex-none text-muted-foreground/70" />
                )}
                {event.location.startsWith('http') ? (
                  <a
                    href={event.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Enter class
                  </a>
                ) : (
                  <span className="truncate">{event.location}</span>
                )}
              </div>
            )}

            {event.meeting_url && platformLink && (
              <div className="flex items-center gap-2.5">
                <ExternalLink className="h-4 w-4 flex-none text-muted-foreground/70" />
                <button
                  type="button"
                  onClick={() => void openPlatformPage(platformLink.track, platformLink.path)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open on {platformLink.track.toUpperCase()} / Открыть на {platformLink.track.toUpperCase()}
                </button>
              </div>
            )}

            {event.meeting_url && !platformLink && (
              <div className="flex items-center gap-2.5">
                <Video className="h-4 w-4 flex-none text-muted-foreground/70" />
                <a
                  href={event.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Join / Войти
                </a>
              </div>
            )}

            {event.groups && event.groups.length > 0 && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 flex-none text-muted-foreground/70" />
                <span className="truncate">{event.groups.join(', ')}</span>
              </div>
            )}
          </div>

          {sub && (
            <div className="mt-3 w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Substituted by: {event.teacher_name || 'Another teacher'}
            </div>
          )}
          {event.is_substitution && !sub && (
            <div className="mt-3 w-fit rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
              You are substituting
            </div>
          )}

          {canAct && (
            <div className="mt-5 border-t border-border pt-4">
              {existing ? (
                <div className="w-fit rounded-md bg-yellow-50 px-2.5 py-1.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                  Request {existing.status.replace('_', ' ')}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRequest('substitution', event)}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    Find substitute
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequest('reschedule', event)}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequest('cancel', event)}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-muted dark:text-rose-400"
                  >
                    Cancel lesson
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
