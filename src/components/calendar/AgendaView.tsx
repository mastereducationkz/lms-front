import type { Event } from '../../types';
import {
  cx, formatTime, eventStyle, eventTitle, typeLabel, isSubstitutedForTeacher, startOfDay, isSameDay,
} from './calendarUtils';
import { CalendarDays } from 'lucide-react';

interface Props {
  events: Event[];
  user: { id?: number | string; role?: string } | null | undefined;
  onEventClick: (event: Event) => void;
}

interface DayGroup {
  date: Date;
  events: Event[];
}

function groupUpcoming(events: Event[]): DayGroup[] {
  const today0 = startOfDay(new Date());
  const upcoming = events
    .filter((e) => startOfDay(new Date(e.start_datetime)).getTime() >= today0.getTime())
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  upcoming.forEach((e) => {
    const d = startOfDay(new Date(e.start_datetime));
    const key = d.toDateString();
    let g = byKey.get(key);
    if (!g) {
      g = { date: d, events: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.events.push(e);
  });
  return groups;
}

function dayLabel(date: Date, today: Date): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export default function AgendaView({ events, user, onEventClick }: Props) {
  const now = new Date();
  const groups = groupUpcoming(events);
  let nextMarked = false;

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-muted-foreground shadow-sm">
        <CalendarDays className="mb-3 h-10 w-10 opacity-20" />
        <p className="text-sm">No upcoming events.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-sm sm:p-2">
      {groups.map((g, gi) => {
        const isToday = isSameDay(g.date, now);
        return (
          <div key={gi}>
            <div className="flex items-baseline gap-2.5 px-4 pb-1 pt-4">
              <span className="text-[15px] font-bold tracking-tight text-foreground">
                {dayLabel(g.date, now)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {g.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              {isToday && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Today
                </span>
              )}
            </div>

            {g.events.map((event) => {
              const s = eventStyle(event);
              const sub = isSubstitutedForTeacher(event, user);
              const ended = new Date(event.end_datetime).getTime() < now.getTime();
              const isNext = !ended && !nextMarked;
              if (isNext) nextMarked = true;
              const online = event.is_online || !!event.meeting_url;
              const isAssignment = event.event_type === 'assignment';

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventClick(event)}
                  className={cx(
                    'flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-left transition',
                    isNext ? 'bg-primary/5' : 'hover:bg-muted/50',
                    ended && 'opacity-50',
                  )}
                >
                  <span className="w-[52px] flex-none text-right text-[13px] font-semibold tabular-nums text-foreground">
                    {formatTime(event.start_datetime)}
                  </span>
                  <span className={cx('h-2 w-2 flex-none rounded-full ring-4', s.dot, s.ring)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">
                      {eventTitle(event)}
                      {sub && <span className={cx('ml-2 text-[10px] font-bold', s.time)}>SUB</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                      <span className={cx('text-[10.5px] font-semibold uppercase tracking-wide', s.time)}>
                        {typeLabel(event.event_type)}
                      </span>
                      {event.event_type !== 'class' && event.groups && event.groups.length > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{event.groups.join(', ')}</span>
                        </>
                      )}
                      {!online && event.location && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{event.location}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {(online || isAssignment) && (
                    <span className="flex-none text-[12px] font-semibold text-primary">
                      {isAssignment ? 'Open →' : 'Join →'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
