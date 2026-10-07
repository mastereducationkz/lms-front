import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cx } from '../calendar/calendarUtils';
import { almatyDayKey, shortDate, type Locale } from '../../lib/recordings';
import { monthTitle, monthWeeks, shiftMonth, thisMonth, weekdayNames } from '../../lib/recordingCalendar';
import { listRecordingDays, type RecordingDays, type RecordingDaysQuery } from '../../services/api/recordings';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/recordings';

interface Props {
  /** The chosen Almaty day, "YYYY-MM-DD", or null for every date. */
  value: string | null;
  onChange: (day: string | null) => void;
  /** The list's other filters: the marks count only what the list would show for that day. */
  filters: Omit<RecordingDaysQuery, 'month'>;
  locale: Locale;
}

/**
 * The Recordings library's date picker: a month in which every day that has recordings shows
 * how many, and picking one lists that day. Days are Almaty days, counted by the server under
 * the same access rule and filters as the list itself.
 */
export default function RecordingDatePicker({ value, onChange, filters, locale }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value ? value.slice(0, 7) : thisMonth()));
  const [data, setData] = useState<RecordingDays | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const cache = useRef(new Map<string, RecordingDays>());
  const latest = useRef(0);

  const filterKey = JSON.stringify(filters);
  // Other filters changed: every month cached so far counted something else.
  useEffect(() => { cache.current.clear(); }, [filterKey]);

  useEffect(() => {
    if (!open) return;
    const key = `${month}|${filterKey}`;
    const known = cache.current.get(key);
    setFailed(false);
    if (known) {
      setData(known);
      return;
    }
    setData(null);
    const request = ++latest.current;
    listRecordingDays({ ...(JSON.parse(filterKey) as Omit<RecordingDaysQuery, 'month'>), month })
      .then((days) => {
        cache.current.set(key, days);
        if (request === latest.current) setData(days);
      })
      .catch(() => { if (request === latest.current) setFailed(true); });
  }, [open, month, filterKey, retryKey]);

  const now = new Date();
  const today = almatyDayKey(now);
  const current = thisMonth(now);
  const weeks = useMemo(() => monthWeeks(month), [month]);

  const pick = (day: string | null) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <div className="inline-flex items-stretch">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setMonth(value ? value.slice(0, 7) : current);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={value ? shortDate(value, now, locale) : t('recordings.datePicker.pick')}
            className={cx(
              'inline-flex h-9 items-center gap-2 border px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value
                ? 'rounded-l-lg border-primary/40 bg-primary/10 text-foreground'
                : 'rounded-lg border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4 flex-none" aria-hidden />
            {value ? shortDate(value, now, locale) : t('recordings.datePicker.pick')}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[19rem] p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label={t('recordings.datePicker.prev')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-foreground" aria-live="polite">{monthTitle(month, locale)}</div>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= current}
              aria-label={t('recordings.datePicker.next')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
            {weekdayNames(locale).map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.flat().map((cell) => {
              if (!cell.inMonth) return <span key={cell.key} className="h-10" aria-hidden />;
              const n = data?.days[cell.key] ?? 0;
              const selected = cell.key === value;
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!n && !selected}
                  aria-pressed={selected}
                  aria-label={n
                    ? t('recordings.datePicker.dayCount', { label: shortDate(cell.key, now, locale), count: n })
                    : t('recordings.datePicker.dayEmpty', { label: shortDate(cell.key, now, locale) })}
                  onClick={() => pick(cell.key)}
                  className={cx(
                    'flex h-10 flex-col items-center justify-center rounded-md text-[13px] leading-none tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : n ? 'font-medium text-foreground hover:bg-muted' : 'cursor-default text-muted-foreground/40',
                    cell.key === today && !selected && 'ring-1 ring-inset ring-primary/50',
                  )}
                >
                  <span>{cell.day}</span>
                  <span
                    className={cx(
                      'mt-1 text-[9px] font-semibold',
                      selected ? 'text-primary-foreground/85' : 'text-primary',
                      !n && 'invisible',
                    )}
                  >
                    {n || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex min-h-[1.75rem] items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {failed ? (
              <span className="inline-flex items-center gap-1.5">
                {t('recordings.datePicker.failed')}
                <button
                  type="button"
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden /> {t('recordings.datePicker.retry')}
                </button>
              </span>
            ) : data === null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label={t('common.loading')} />
            ) : (
              <span>{data.total ? t('recordings.datePicker.monthCount', { count: data.total }) : t('recordings.datePicker.none')}</span>
            )}
            {value && (
              <button type="button" onClick={() => pick(null)} className="font-medium text-foreground hover:underline">
                {t('recordings.datePicker.clear')}
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('recordings.datePicker.clear')}
          title={t('recordings.datePicker.clear')}
          className="inline-flex h-9 items-center rounded-r-lg border border-l-0 border-primary/40 bg-primary/10 px-2 text-muted-foreground transition hover:bg-primary/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
