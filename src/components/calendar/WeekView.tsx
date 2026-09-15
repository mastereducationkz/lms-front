import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import MeetMark from './MeetMark';
import RecordingMark from './RecordingMark';
import type { Event } from '../../types';
import {
  cx, formatTime, eventStyle, isSubstitutedForTeacher,
  eventsOnDay, weekTimeWindow, isSameDay, DAY_NAMES,
  minutesInAlmaty,
} from './calendarUtils';
import { todayInAlmaty } from '../../lib/datetime';
import {
  cardTitle, countLabel, lanesForWidth, planDay, tileDots, tileLabel, tileTooltip, type HourTile,
} from './weekLayout';

interface Props {
  weekDays: Date[];
  events: Event[];
  user: { id?: number | string; role?: string } | null | undefined;
  onEventClick: (event: Event) => void;
  /** A busy hour's tile was clicked: show that hour's events in the day list. */
  onSlotClick?: (day: Date, hour: number) => void;
}

const HOUR_PX = 52;
const PX_PER_MIN = HOUR_PX / 60;
const GUTTER_PX = 56;
const GRID_COLS = `${GUTTER_PX}px repeat(7, minmax(0, 1fr))`;
const TILE_PX = HOUR_PX - 4;

type User = Props['user'];

function EventCard({ event, user, now, style, onClick }: {
  event: Event; user: User; now: Date; style: CSSProperties; onClick: () => void;
}) {
  const s = eventStyle(event);
  const sub = isSubstitutedForTeacher(event, user);
  const isAssignment = event.event_type === 'assignment';
  const past = new Date(event.end_datetime).getTime() < now.getTime();
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${event.title} · ${formatTime(event.start_datetime)}`}
      style={style}
      className={cx(
        'absolute overflow-hidden rounded-lg border px-2 py-1 text-left transition hover:brightness-95 dark:hover:brightness-110',
        s.blockBg, s.blockBorder,
        sub && 'border-dashed',
        past && 'opacity-55 grayscale-[.35]',
      )}
    >
      <div className={cx('flex items-center gap-1 text-[10.5px] font-bold tabular-nums', s.time)}>
        {isAssignment ? '⚑ ' : ''}{formatTime(event.start_datetime)}
        <RecordingMark event={event} role={user?.role} className="h-2.5 w-2.5" />
        <MeetMark event={event} role={user?.role} className="h-2.5 w-2.5" />
      </div>
      <div className="truncate text-[11.5px] font-medium text-foreground">{cardTitle(event)}</div>
    </button>
  );
}

/** One start hour of a busy day: how many events, which groups, and a way into the list. */
function SlotTile({ tile, day, top, now, onClick }: {
  tile: HourTile; day: Date; top: number; now: Date; onClick: () => void;
}) {
  const hh = `${String(tile.hour).padStart(2, '0')}:00`;
  const { dots, extra } = tileDots(tile);
  const allPast = tile.events.every((e) => new Date(e.end_datetime).getTime() < now.getTime());
  const dayLabel = day.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <button
      type="button"
      onClick={onClick}
      title={tileTooltip(tile)}
      aria-label={`${hh}, ${tileLabel(tile)}, ${dayLabel}`}
      style={{ top, height: TILE_PX, left: 3, right: 3 }}
      className={cx(
        'absolute flex flex-col justify-center gap-1.5 overflow-hidden rounded-lg border border-border bg-muted/50 px-2 py-1 text-left transition hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        allPast && 'opacity-55 grayscale-[.35]',
      )}
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="flex-none text-[10.5px] font-bold tabular-nums text-muted-foreground">{hh}</span>
        <span className="truncate text-[11.5px] font-semibold text-foreground">{tileLabel(tile)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1" aria-hidden="true">
        {dots.map((dot) => (
          <i key={dot} className={cx('h-1.5 w-1.5 flex-none rounded-full', dot)} />
        ))}
        {extra > 0 && <span className="text-[10px] font-medium leading-none text-muted-foreground">+{extra}</span>}
      </div>
    </button>
  );
}

/** Side-by-side cards a day column can hold, re-measured as the grid resizes. */
function useLanes(ref: RefObject<HTMLDivElement>): number {
  const [lanes, setLanes] = useState(2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number) => setLanes(lanesForWidth((width - GUTTER_PX) / 7));
    measure(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return lanes;
}

export default function WeekView({ weekDays, events, user, onEventClick, onSlotClick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const maxLanes = useLanes(gridRef);

  const days = useMemo(
    () => weekDays.map((day) => {
      const dayEvents = eventsOnDay(day, events);
      return { day, dayEvents, plan: planDay(dayEvents, maxLanes) };
    }),
    [weekDays, events, maxLanes],
  );

  const weekEvents = days.flatMap((d) => d.dayEvents);
  const { startMin, endMin } = weekTimeWindow(weekEvents);
  const hours: number[] = [];
  for (let h = startMin / 60; h <= endMin / 60; h++) hours.push(h);
  const bodyHeight = (endMin - startMin) * PX_PER_MIN;

  // The school's clock, not the laptop's: events are placed in Almaty time, so "now" must be too.
  const now = new Date();
  const nowMin = minutesInAlmaty(now.toISOString());
  const today = todayInAlmaty();
  const todayIdx = weekDays.findIndex((d) => isSameDay(d, today));
  const showNow = todayIdx >= 0 && nowMin >= startMin && nowMin <= endMin;

  const openTile = (day: Date, tile: HourTile) => {
    if (tile.events.length > 1 && onSlotClick) onSlotClick(day, tile.hour);
    else onEventClick(tile.events[0]);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Day header */}
      <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: GRID_COLS }}>
        <div />
        {days.map(({ day, dayEvents, plan }, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className="border-l border-border px-2 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_NAMES[i]}
              </div>
              <div
                className={cx(
                  'mx-auto mt-1 flex h-7 w-7 items-center justify-center text-[15px] font-semibold',
                  isToday ? 'rounded-full bg-primary text-primary-foreground' : 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
              {plan.mode === 'summary' && (
                <div className="mt-1 truncate text-[10.5px] leading-none text-muted-foreground">
                  {countLabel(dayEvents)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        ref={gridRef}
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
        {days.map(({ day, plan }, di) => (
          <div key={di} className="relative border-l border-border" style={{ height: bodyHeight }}>
            {hours.slice(0, -1).map((h) => (
              <div key={h} className="border-b border-dashed border-border/70" style={{ height: HOUR_PX }} />
            ))}

            {plan.mode === 'detail' &&
              plan.laid.map(({ event, start, end, col, ncols }) => (
                <EventCard
                  key={event.id}
                  event={event}
                  user={user}
                  now={now}
                  onClick={() => onEventClick(event)}
                  style={{
                    top: (start - startMin) * PX_PER_MIN,
                    height: Math.max((end - start) * PX_PER_MIN - 3, 18),
                    left: `calc(${(col / ncols) * 100}% + 3px)`,
                    width: `calc(${100 / ncols}% - 6px)`,
                  }}
                />
              ))}

            {plan.mode === 'summary' &&
              plan.tiles.map((tile) => {
                const top = (tile.hour * 60 - startMin) * PX_PER_MIN;
                return tile.events.length === 1 ? (
                  <EventCard
                    key={tile.hour}
                    event={tile.events[0]}
                    user={user}
                    now={now}
                    onClick={() => onEventClick(tile.events[0])}
                    style={{ top, height: TILE_PX, left: 3, right: 3 }}
                  />
                ) : (
                  <SlotTile
                    key={tile.hour}
                    tile={tile}
                    day={day}
                    top={top}
                    now={now}
                    onClick={() => openTile(day, tile)}
                  />
                );
              })}
          </div>
        ))}

        {/* Now line */}
        {showNow && (
          <div
            className="pointer-events-none absolute z-10 border-t-2 border-red-500"
            style={{
              top: (nowMin - startMin) * PX_PER_MIN,
              left: GUTTER_PX,
              right: 0,
            }}
          >
            <span className="absolute -left-[50px] -top-2.5 text-[10px] font-bold tabular-nums text-red-500">
              {formatTime(now.toISOString())}
            </span>
            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
