import type { Event } from '../../types';
import {
  cx, formatTime, eventStyle, eventTitle, isSubstitutedForTeacher, DAY_NAMES, type MonthDay,
} from './calendarUtils';

interface Props {
  days: MonthDay[];
  user: { id?: number | string; role?: string } | null | undefined;
  onDayClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}

const MAX_CHIPS = 3;

export default function MonthView({ days, user, onDayClick, onEventClick }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className={cx(
              'px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide',
              i >= 5 ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isLastRow = idx >= 35;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDayClick(day.date)}
              className={cx(
                'flex min-h-[92px] flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-[118px]',
                '[&:nth-child(7n)]:border-r-0',
                isLastRow && 'border-b-0',
                'hover:bg-muted/50',
                !day.isCurrentMonth && 'bg-muted/30',
                day.isWeekend && day.isCurrentMonth && 'bg-muted/20',
              )}
            >
              <span
                className={cx(
                  'inline-flex h-6 w-6 items-center justify-center text-[13px] font-medium',
                  day.isToday && 'rounded-full bg-primary font-semibold text-primary-foreground',
                  !day.isToday && day.isCurrentMonth && 'text-foreground',
                  !day.isToday && !day.isCurrentMonth && 'text-muted-foreground/60',
                )}
              >
                {day.date.getDate()}
              </span>

              <div className="flex flex-col gap-0.5">
                {day.events.slice(0, MAX_CHIPS).map((event) => {
                  const s = eventStyle(event);
                  const sub = isSubstitutedForTeacher(event, user);
                  return (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onEventClick(event);
                        }
                      }}
                      title={`${event.title} · ${formatTime(event.start_datetime)}${sub ? ' (Substituted)' : ''}`}
                      className={cx(
                        'flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[11.5px] leading-tight transition hover:brightness-95 dark:hover:brightness-125',
                        s.chipBg,
                        sub && 'opacity-80',
                      )}
                    >
                      <span className={cx('h-1.5 w-1.5 flex-none rounded-full', s.dot, sub && 'opacity-60')} />
                      <span className={cx('flex-none font-semibold tabular-nums', s.time)}>
                        {formatTime(event.start_datetime)}
                      </span>
                      <span className="truncate text-foreground/90">{eventTitle(event)}</span>
                      {sub && (
                        <span className={cx('flex-none text-[9px] font-bold tracking-tight', s.time)}>SUB</span>
                      )}
                    </span>
                  );
                })}

                {day.events.length > MAX_CHIPS && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(day.date);
                    }}
                    className="px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-primary"
                  >
                    +{day.events.length - MAX_CHIPS} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
