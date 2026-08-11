import type { Event } from '../../types';
import {
  cx, formatTime, eventStyle, eventTitle, isSubstitutedForTeacher,
  eventsOnDay, layoutDayColumns, weekTimeWindow, isSameDay, DAY_NAMES,
} from './calendarUtils';

interface Props {
  weekDays: Date[];
  events: Event[];
  user: { id?: number | string; role?: string } | null | undefined;
  onEventClick: (event: Event) => void;
}

const HOUR_PX = 52;
const PX_PER_MIN = HOUR_PX / 60;
const GRID_COLS = '56px repeat(7, minmax(0, 1fr))';

export default function WeekView({ weekDays, events, user, onEventClick }: Props) {
  const weekEvents = weekDays.flatMap((d) => eventsOnDay(d, events));
  const { startMin, endMin } = weekTimeWindow(weekEvents);
  const hours: number[] = [];
  for (let h = startMin / 60; h <= endMin / 60; h++) hours.push(h);
  const bodyHeight = (endMin - startMin) * PX_PER_MIN;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = weekDays.findIndex((d) => isSameDay(d, now));
  const showNow = todayIdx >= 0 && nowMin >= startMin && nowMin <= endMin;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Day header */}
      <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: GRID_COLS }}>
        <div />
        {weekDays.map((d, i) => {
          const today = isSameDay(d, now);
          return (
            <div key={i} className="border-l border-border px-2 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_NAMES[i]}
              </div>
              <div
                className={cx(
                  'mx-auto mt-1 flex h-7 w-7 items-center justify-center text-[15px] font-semibold',
                  today ? 'rounded-full bg-primary text-primary-foreground' : 'text-foreground',
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="relative grid max-h-[560px] overflow-y-auto"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        {/* Hour gutter */}
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_PX }}>
              <span className="absolute -top-2 right-2 text-[10.5px] tabular-nums text-muted-foreground/70">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, di) => {
          const laid = layoutDayColumns(eventsOnDay(day, events));
          return (
            <div key={di} className="relative border-l border-border" style={{ height: bodyHeight }}>
              {hours.slice(0, -1).map((h) => (
                <div key={h} className="border-b border-dashed border-border/70" style={{ height: HOUR_PX }} />
              ))}

              {laid.map(({ event, start, end, col, ncols }) => {
                const s = eventStyle(event);
                const sub = isSubstitutedForTeacher(event, user);
                const isAssignment = event.event_type === 'assignment';
                const past = new Date(event.end_datetime).getTime() < now.getTime();
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    title={`${event.title} · ${formatTime(event.start_datetime)}`}
                    style={{
                      top: (start - startMin) * PX_PER_MIN,
                      height: Math.max((end - start) * PX_PER_MIN - 3, 18),
                      left: `calc(${(col / ncols) * 100}% + 3px)`,
                      width: `calc(${100 / ncols}% - 6px)`,
                    }}
                    className={cx(
                      'absolute overflow-hidden rounded-lg border px-2 py-1 text-left transition hover:brightness-95 dark:hover:brightness-110',
                      s.blockBg, s.blockBorder,
                      sub && 'border-dashed',
                      past && 'opacity-55 grayscale-[.35]',
                    )}
                  >
                    <div className={cx('text-[10.5px] font-bold tabular-nums', s.time)}>
                      {isAssignment ? '⚑ ' : ''}{formatTime(event.start_datetime)}
                    </div>
                    <div className="truncate text-[11.5px] font-medium text-foreground">
                      {isAssignment ? event.title.replace(/^Deadline:\s*/i, '') : eventTitle(event)}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Now line */}
        {showNow && (
          <div
            className="pointer-events-none absolute z-10 border-t-2 border-red-500"
            style={{
              top: (nowMin - startMin) * PX_PER_MIN,
              left: 56,
              right: 0,
            }}
          >
            <span className="absolute -left-[50px] -top-2.5 text-[10px] font-bold tabular-nums text-red-500">
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
            </span>
            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
