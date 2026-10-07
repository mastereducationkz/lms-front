import { Link2, Link2Off } from 'lucide-react';
import type { Event } from '../../types';
import { isMeetLink, seesMeetMarks } from '../../lib/meetLinks';
import { cx } from './calendarUtils';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/sharedUi';

interface Props {
  event: Event;
  role?: string | null;
  /** Sizing and spacing of the icon itself. */
  className?: string;
}

/**
 * Whether a class lesson has its Google Meet room — a link when it does, a muted broken link when
 * it does not. Deliberately not a camera: the ▶ and the camera already mean «recording».
 * Staff only: a student needs the join button, not a warning about a room that is their
 * teacher's to set up. Nothing for webinars, tests or assignments.
 */
export default function MeetMark({ event, role, className }: Props) {
  const t = useT();
  if (event.event_type !== 'class' || !seesMeetMarks(role)) return null;
  const has = isMeetLink(event.meeting_url);
  const label = has ? t('sharedUi.meetMark.has') : t('sharedUi.meetMark.missing');
  const Icon = has ? Link2 : Link2Off;
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex flex-none items-center">
      <Icon
        aria-hidden
        className={cx(has ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/70', className)}
      />
    </span>
  );
}
