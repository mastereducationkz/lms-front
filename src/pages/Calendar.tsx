import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Filter, Users,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import Loader from '../components/Loader';
import {
  getCalendarEvents, getTeacherGroups, getCuratorGroups, getGroups, getMyLessonRequests,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Event, EventType, LessonRequest } from '../types';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import AgendaView from '../components/calendar/AgendaView';
import EventDetailDialog, { type RequestType } from '../components/calendar/EventDetailDialog';
import {
  cx, formatTime, styleFor, eventStyle, eventTitle, typeLabel,
  buildMonthDays, buildWeekDays, eventsOnDay, MONTH_NAMES,
} from '../components/calendar/calendarUtils';

type CalView = 'month' | 'week' | 'agenda';
const VIEWS: { id: CalView; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'agenda', label: 'Agenda' },
];

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewDate, setViewDate] = useState(new Date());
  const [view, setView] = useState<CalView>(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('calendar_view')) as CalView | null;
    if (saved === 'month' || saved === 'week' || saved === 'agenda') return saved;
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'month';
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | 'all'>('all');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [myRequests, setMyRequests] = useState<Map<number, LessonRequest>>(new Map());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [dayPeek, setDayPeek] = useState<Date | null>(null);

  useEffect(() => {
    localStorage.setItem('calendar_view', view);
  }, [view]);

  const monthKey = `${viewDate.getFullYear()}-${viewDate.getMonth()}`;
  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGroups = async () => {
    try {
      let fetched: any[] = [];
      if (user?.role === 'teacher') fetched = await getTeacherGroups();
      else if (user?.role === 'curator') fetched = await getCuratorGroups();
      else if (user?.role === 'admin' || user?.role === 'head_curator' || user?.role === 'head_teacher')
        fetched = await getGroups();
      setGroups(fetched || []);
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Load a 3-month window so Week/Agenda near month edges still have data.
      const months = [-1, 0, 1]
        .map((off) => {
          const d = new Date(viewDate.getFullYear(), viewDate.getMonth() + off, 1);
          return { year: d.getFullYear(), month: d.getMonth() + 1 };
        })
        .filter((m) => m.year >= 2020 && m.year <= 2030);

      const [monthResults, requests] = await Promise.all([
        Promise.all(months.map((m) => getCalendarEvents(m.year, m.month))),
        user?.role === 'teacher' ? getMyLessonRequests() : Promise.resolve([]),
      ]);

      const byId = new Map<number, Event>();
      monthResults.flat().forEach((e) => byId.set(e.id, e));
      setEvents([...byId.values()]);

      const reqMap = new Map<number, LessonRequest>();
      requests.forEach((r) => {
        if (r.event_id) reqMap.set(r.event_id, r);
      });
      setMyRequests(reqMap);
    } catch (e) {
      console.error('Failed to load calendar events:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = events;
    if (eventTypeFilter !== 'all') list = list.filter((e) => e.event_type === eventTypeFilter);
    if (selectedGroupId !== 'all') {
      const gid = parseInt(selectedGroupId, 10);
      list = list.filter((e) => e.group_ids && e.group_ids.includes(gid));
    }
    if (user?.role === 'admin') list = list.filter((e) => e.event_type !== 'assignment');
    return list;
  }, [events, eventTypeFilter, selectedGroupId, user]);

  const monthDays = useMemo(() => buildMonthDays(viewDate, filtered), [viewDate, filtered]);
  const weekDays = useMemo(() => buildWeekDays(viewDate), [viewDate]);

  const goPrevNext = (dir: 'prev' | 'next') => {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (view === 'week') d.setDate(prev.getDate() + (dir === 'next' ? 7 : -7));
      else d.setMonth(prev.getMonth() + (dir === 'next' ? 1 : -1));
      return d;
    });
  };

  const rangeLabel = useMemo(() => {
    if (view === 'week') {
      const a = weekDays[0];
      const b = weekDays[6];
      const am = MONTH_NAMES[a.getMonth()].slice(0, 3);
      const bm = MONTH_NAMES[b.getMonth()].slice(0, 3);
      return a.getMonth() === b.getMonth()
        ? `${am} ${a.getDate()} – ${b.getDate()}`
        : `${am} ${a.getDate()} – ${bm} ${b.getDate()}`;
    }
    return `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  }, [view, weekDays, viewDate]);

  const openEvent = (event: Event) => {
    setDayPeek(null);
    setSelectedEvent(event);
  };

  const onRequest = (type: RequestType, event: Event) => {
    const params = new URLSearchParams({
      type,
      event_id: String(event.id),
      group_id: String(event.group_ids?.[0] || 0),
      title: event.title,
      datetime: event.start_datetime,
    });
    setSelectedEvent(null);
    navigate(`/lesson-requests/new?${params.toString()}`);
  };

  const canCreate = user?.role === 'admin' || user?.role === 'curator';
  const showGroupFilter =
    (user?.role === 'teacher' || user?.role === 'curator' || user?.role === 'admin') && groups.length > 0;

  if (loading && events.length === 0) {
    return <Loader size="xl" animation="spin" color="#2563eb" />;
  }

  const dayPeekEvents = dayPeek ? eventsOnDay(dayPeek, filtered) : [];

  return (
    <div className="space-y-4 p-2 sm:p-4 lg:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => goPrevNext('prev')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[130px] text-center text-[15px] font-semibold tracking-tight sm:min-w-[150px]">
            {rangeLabel}
          </div>
          <button
            type="button"
            aria-label="Next"
            onClick={() => goPrevNext('next')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())} className="text-xs sm:text-sm">
          Today
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {/* View switcher */}
          <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                  view === v.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 flex-none text-muted-foreground" />
            <Select value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as EventType | 'all')}>
              <SelectTrigger className="h-9 w-[130px] sm:w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="class">Classes</SelectItem>
                <SelectItem value="weekly_test">Weekly tests</SelectItem>
                <SelectItem value="webinar">Webinars</SelectItem>
                <SelectItem value="assignment">Assignments</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Group filter (staff) */}
          {showGroupFilter && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 flex-none text-muted-foreground" />
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-9 w-[130px] sm:w-40">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canCreate && (
            <Button
              size="sm"
              onClick={() => navigate(user?.role === 'admin' ? '/admin/events/create' : '/curator/events/create')}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex -space-x-1">
            <i className="h-2 w-2 rounded-full bg-blue-500 ring-1 ring-card" />
            <i className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card" />
            <i className="h-2 w-2 rounded-full bg-fuchsia-500 ring-1 ring-card" />
          </span>
          Classes — by group
        </span>
        {(['weekly_test', 'webinar', 'assignment'] as EventType[]).map((t) => {
          const s = styleFor(t);
          return (
            <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <i className={cx('h-2 w-2 rounded-full', s.dot)} />
              {s.label}
            </span>
          );
        })}
      </div>

      {/* Active view */}
      {view === 'month' && (
        <MonthView days={monthDays} user={user} onDayClick={setDayPeek} onEventClick={openEvent} />
      )}
      {view === 'week' && (
        <WeekView weekDays={weekDays} events={filtered} user={user} onEventClick={openEvent} />
      )}
      {view === 'agenda' && <AgendaView events={filtered} user={user} onEventClick={openEvent} />}

      {/* Day popup (month) */}
      <Dialog open={!!dayPeek} onOpenChange={(o) => !o && setDayPeek(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0">
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <span className="font-bold">
                {dayPeek?.toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
              <span className="font-normal text-muted-foreground">
                {dayPeek?.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
              </span>
              {dayPeek && dayPeek.toDateString() === new Date().toDateString() && (
                <Badge className="border-0 bg-primary/10 text-primary hover:bg-primary/10">Today</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
            {dayPeekEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No events scheduled for this day.</p>
            ) : (
              dayPeekEvents.map((event) => {
                const s = eventStyle(event);
                const past = new Date(event.end_datetime).getTime() < Date.now();
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEvent(event)}
                    className={cx(
                      'flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-muted',
                      past && 'opacity-55',
                    )}
                  >
                    <span className="w-11 flex-none text-right text-[13px] font-semibold tabular-nums text-foreground">
                      {formatTime(event.start_datetime)}
                    </span>
                    <span className={cx('h-2 w-2 flex-none rounded-full ring-4', s.dot, s.ring)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{eventTitle(event)}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className={cx('font-semibold', s.time)}>{typeLabel(event.event_type)}</span>
                        {event.event_type !== 'class' && event.groups && event.groups.length > 0 && ` · ${event.groups.join(', ')}`}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Event detail */}
      <EventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(o) => !o && setSelectedEvent(null)}
        user={user}
        myRequests={myRequests}
        onRequest={onRequest}
      />
    </div>
  );
}
