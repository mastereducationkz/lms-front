import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Copy, ExternalLink, MapPin, Video, Users } from 'lucide-react';
import { toast } from 'sonner';
import { openPlatformPage, parsePlatformUrl } from '../../lib/platformLinks';
import { meetInvitationText, meetJoinUrl } from '../../lib/meetLinks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import LessonRecordingSection from './LessonRecordingSection';
import { lessonPath } from '../../lib/lessonLinks';
import type { Event } from '../../types';
import { cx, formatTime, eventStyle, typeLabel } from './calendarUtils';
import { substitutionBadge } from '../../lib/substitutionBadge';
import { formatDate } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/calendar';

interface Props {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id?: number | string; role?: string; workspace_email?: string | null } | null | undefined;
}

/**
 * The calendar's lesson card. A class lesson's card is short since 2026-09-28 — when, which group,
 * «Join» and «Open lesson →»: materials, the recording, the register and scores, Meet details, notes
 * and the teacher's requests all live on the lesson's own page (/lessons/:id). Webinars and other
 * events keep their card as it was.
 */
export default function EventDetailDialog({ event, open, onOpenChange, user }: Props) {
  const t = useT();
  const locale = useLocale();
  if (!event) return null;
  // Auto-managed weekly-test events link to the set page on the platform: open it signed in.
  const platformLink = event.event_type === 'weekly_test' ? parsePlatformUrl(event.meeting_url) : null;
  const s = eventStyle(event);
  const isClass = event.event_type === 'class';
  // What this lesson's substitution means for whoever is reading it.
  const badge = substitutionBadge(event, user);
  const dateLabel = formatDate(event.start_datetime, { weekday: 'long', day: 'numeric', month: 'long' }, locale);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className={cx('h-1 flex-none', s.dot)} />
        <div className="overflow-y-auto p-6">
          <DialogHeader className="space-y-1">
            <div className={cx('text-[11px] font-bold uppercase tracking-wider', s.time)}>
              {typeLabel(event.event_type)}
              {badge && ` · ${t('calendar.event.substituted')}`}
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
                  ? t('calendar.event.due', { time: formatTime(event.start_datetime), date: dateLabel })
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
                    {t('calendar.event.enterClass')}
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
                  {t('calendar.event.openOnPlatform', { platform: platformLink.track.toUpperCase() })}
                </button>
              </div>
            )}

            {event.meeting_url && !platformLink && (
              <div className="flex items-center gap-2.5">
                <Video className="h-4 w-4 flex-none text-muted-foreground/70" />
                <a
                  href={meetJoinUrl(event.meeting_url, user?.workspace_email)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('calendar.event.join')}
                </a>
                {/* A ready-to-send invitation for the group chat, built on the clean link. The
                    Join link above may carry the viewer's own account (?authuser=…), which
                    would ask students to sign in as the teacher. */}
                <button
                  type="button"
                  onClick={() => {
                    const text = meetInvitationText({ ...event, meeting_url: event.meeting_url as string }, locale);
                    navigator.clipboard.writeText(text).then(
                      () => toast.success(t('calendar.event.invitationCopied'), { description: t('calendar.event.invitationCopiedHint') }),
                      () => toast.error(t('calendar.event.invitationCopyFailed')),
                    );
                  }}
                  title={t('calendar.event.copyInvitationTitle')}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {t('calendar.event.copyInvitation')}
                </button>
              </div>
            )}

            {event.groups && event.groups.length > 0 && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 flex-none text-muted-foreground/70" />
                <span className="truncate">{event.groups.join(', ')}</span>
              </div>
            )}
          </div>

          {badge && (
            <div className={cx(
              'mt-3 w-fit rounded-md border px-2 py-1 text-xs font-semibold',
              badge.tone === 'covering'
                ? 'border-brand-border bg-brand-surface text-brand-subtle-foreground'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
            )}>
              {badge.text}
            </div>
          )}

          {/* A webinar keeps its recording on the card; a class lesson's lives on its page. */}
          {event.event_type === 'webinar' && <LessonRecordingSection event={event} />}

          {isClass && (
            <Link
              to={lessonPath(event.id)}
              onClick={() => onOpenChange(false)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('calendar.event.openLesson')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
