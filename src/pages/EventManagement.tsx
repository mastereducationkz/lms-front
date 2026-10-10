import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Users, 
  Clock, 
  MapPin,
  Video,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import Loader from '../components/Loader';
import { getAllEvents, deleteEvent, bulkDeleteEvents, getAllGroups, getEventSeries } from '../services/api';
import { SeriesDeleteDialog, SeriesRow, type SeriesScope } from '../components/events/SeriesScope';
import { groupSeries, type EventListItem } from '../lib/eventSeries';
import type { Event, EventType, Group } from '../types';
import { formatDate, formatDateTime as formatAppDateTime, type MessageKey } from '../lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

const EVENT_TYPE_KEYS = {
  class: 'adminPages.events.type.class',
  weekly_test: 'adminPages.events.type.weeklyTest',
  webinar: 'adminPages.events.type.webinar',
  assignment: 'adminPages.events.type.assignment',
} as const satisfies Record<EventType, MessageKey>;

export default function EventManagement() {
  const navigate = useNavigate();
  const t = useT();
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<EventType | 'all'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'today' | 'this_week'>('all');
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const [groupWeekly, setGroupWeekly] = useState(true);
  const [seriesCancel, setSeriesCancel] = useState<{ event: Event; following: number; initialScope: SeriesScope } | null>(null);

  const isVirtualEvent = (id: number) => id >= 1000000000;
  const isScheduledLesson = (id: number) => id >= 2000000000;
  const isAssignmentDeadline = (id: number) => id >= 1000000000 && id < 2000000000;


  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, groupsData] = await Promise.all([
        getAllEvents({ exclude_type: showLessons ? undefined : 'class' }),
        getAllGroups()
      ]);
      setEvents(eventsData);
      setGroups(groupsData.groups || groupsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [showLessons]);

  // An occurrence of a recurring series asks what to cancel: only it, or it and every later week.
  const askSeriesCancel = async (event: Event, initialScope: SeriesScope): Promise<boolean> => {
    if (!event.series_id) return false;
    try {
      const info = await getEventSeries(event.id);
      setSeriesCancel({ event, following: info.following, initialScope });
      return true;
    } catch (error) {
      console.error('Failed to load the series:', error);
      return false;                                   // fall back to cancelling just this event
    }
  };

  const confirmSeriesCancel = async (scope: SeriesScope) => {
    if (!seriesCancel) return;
    try {
      await deleteEvent(seriesCancel.event.id, scope);
      setSeriesCancel(null);
      setSelectedEventIds([]);
      await loadData();
    } catch (error) {
      console.error('Failed to cancel events:', error);
      alert(t('adminPages.events.series.cancelFailed'));
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    const target = events.find(event => event.id === eventId);
    if (target && await askSeriesCancel(target, 'this')) {
      return;
    }
    if (!confirm(t('adminPages.events.list.confirmDelete'))) {
      return;
    }

    try {
      await deleteEvent(eventId);
      setEvents(events.filter(event => event.id !== eventId));
      setSelectedEventIds(prev => prev.filter(id => id !== eventId));
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert(t('adminPages.events.list.deleteFailed'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEventIds.length === 0) return;
    
    if (!confirm(t('adminPages.events.list.confirmBulkDelete', { count: selectedEventIds.length }))) {
      return;
    }

    try {
      setIsDeleting(true);
      const realEventIds = selectedEventIds.filter(id => !isVirtualEvent(id));
      if (realEventIds.length === 0) {
        alert(t('adminPages.events.list.cannotDeleteGenerated'));
        return;
      }
      await bulkDeleteEvents(realEventIds);
      setEvents(events.filter(event => !realEventIds.includes(event.id)));
      setSelectedEventIds([]);
    } catch (error) {
      console.error('Failed to delete events:', error);
      alert(t('adminPages.events.list.bulkDeleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedEventIds.length === filteredEvents.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(filteredEvents.map(event => event.id));
    }
  };

  const toggleSelectEvent = (eventId: number) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId) 
        : [...prev, eventId]
    );
  };

  const filteredEvents = events.filter(event => {
    // Search filter: title or any linked group name
    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      const titleHit = event.title.toLowerCase().includes(needle);
      const groupHit = (event.groups || []).some(g => String(g).toLowerCase().includes(needle));
      if (!titleHit && !groupHit) return false;
    }

    // Event type filter
    if (selectedEventType !== 'all' && event.event_type !== selectedEventType) {
      return false;
    }

    // Group filter
    if (selectedGroupId !== 'all') {
      if (!event.group_ids || !event.group_ids.includes(selectedGroupId)) {
        return false;
      }
    }

    // Date filter
    const now = new Date();
    const eventDate = new Date(event.start_datetime);
    
    switch (dateFilter) {
      case 'upcoming':
        return eventDate > now;
      case 'today':
        return eventDate.toDateString() === now.toDateString();
      case 'this_week':
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return eventDate >= now && eventDate <= weekFromNow;
      default:
        return true;
    }
  });

  const formatDateTime = (dateTimeString: string) => {
    return formatAppDateTime(dateTimeString, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeColor = (eventType: EventType) => {
    const withDark: Record<EventType, string> = {
      class: 'bg-brand-subtle text-brand-subtle-foreground border-brand-border',
      weekly_test: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      webinar: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-400 border-red-200 dark:border-red-800',
      assignment: 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    return withDark[eventType] || 'bg-muted text-foreground border-border';
  };

  const listItems: EventListItem[] = groupWeekly
    ? groupSeries(filteredEvents)
    : filteredEvents.map((event): EventListItem => ({ kind: 'event', event }));

  const renderEventRow = (event: Event) => (
              <div key={event.id} className="p-6 hover:bg-muted dark:hover:bg-secondary transition-colors flex items-start gap-4">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(event.id)}
                    onChange={() => toggleSelectEvent(event.id)}
                    className="w-4 h-4 rounded border-input text-brand focus:ring-brand cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Event Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground dark:text-foreground truncate">
                        {event.title}
                      </h3>
                      <Badge className={`${getEventTypeColor(event.event_type)} border`}>
                        {t(EVENT_TYPE_KEYS[event.event_type])}
                      </Badge>
                      {event.is_recurring && (
                        <Badge variant="outline" className="text-brand border-brand-border">
                          {t('adminPages.events.list.recurring')}
                        </Badge>
                      )}
                      {isScheduledLesson(event.id) && (
                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                          {t('adminPages.events.list.scheduledLesson')}
                        </Badge>
                      )}
                      {isAssignmentDeadline(event.id) && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800/60">
                          {t('adminPages.events.list.deadline')}
                        </Badge>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDateTime(event.start_datetime)} - {formatDateTime(event.end_datetime)}
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          {event.is_online ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          {event.location}
                        </div>
                      )}

                      {event.groups && event.groups.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {event.groups.join(', ')}
                        </div>
                      )}

                      {event.teacher_name && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-brand" />
                          <span className="font-medium">{t('adminPages.events.list.teacher', { name: event.teacher_name })}</span>
                        </div>
                      )}

                      {event.max_participants && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {event.participant_count || 0}/{event.max_participants}
                        </div>
                      )}
                    </div>

                    {/* Event Description */}
                    {event.description && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                        {event.description}
                      </p>
                    )}

                    {/* Event Meta */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t('adminPages.events.list.createdBy', { name: event.creator_name || t('adminPages.events.list.unknownCreator') })}</span>
                      <span>•</span>
                      <span>{formatDate(event.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                      disabled={isVirtualEvent(event.id)}
                      title={isVirtualEvent(event.id) ? t('adminPages.events.list.generatedNotEditable') : t('adminPages.events.list.editEvent')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/events/${event.id}`)}
                        >
                          {t('adminPages.events.list.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/events/${event.id}/participants`)}
                        >
                          {t('adminPages.events.participants')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={isVirtualEvent(event.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
  );

  if (loading) {
    return <Loader size="xl" animation="spin" color="hsl(var(--brand))" />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground">{t('adminPages.events.list.title')}</h1>
          <p className="text-muted-foreground">{t('adminPages.events.list.subtitle')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {selectedEventIds.length > 0 && (
            <Button 
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 flex-1 sm:flex-initial"
            >
              <Trash2 className="w-4 h-4" />
              {t('adminPages.events.list.deleteSelected', { count: selectedEventIds.length })}
            </Button>
          )}
          <Button 
            onClick={() => navigate('/admin/events/create')}
            className="flex items-center gap-2 flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            {t('adminPages.events.createEvent')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card dark:bg-card rounded-lg border dark:border-border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('adminPages.events.list.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Event Type Filter */}
          <Select value={selectedEventType} onValueChange={(value) => setSelectedEventType(value as EventType | 'all')}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder={t('adminPages.events.list.typePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminPages.events.list.allTypes')}</SelectItem>
              <SelectItem value="class">{t('adminPages.events.list.classes')}</SelectItem>
              <SelectItem value="weekly_test">{t('adminPages.events.list.weeklyTests')}</SelectItem>
              <SelectItem value="webinar">{t('adminPages.events.list.webinars')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as any)}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder={t('adminPages.events.list.period')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminPages.events.list.allEvents')}</SelectItem>
              <SelectItem value="upcoming">{t('adminPages.events.list.upcoming')}</SelectItem>
              <SelectItem value="today">{t('adminPages.events.list.today')}</SelectItem>
              <SelectItem value="this_week">{t('adminPages.events.list.thisWeek')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Group Filter */}
          <Select value={selectedGroupId.toString()} onValueChange={(value) => setSelectedGroupId(value === 'all' ? 'all' : parseInt(value))}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder={t('adminPages.events.list.group')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminPages.events.list.allGroups')}</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Lessons Toggle */}
          <div className="flex items-center gap-2 px-2 border dark:border-border rounded-md bg-muted dark:bg-secondary h-10">
            <input
              type="checkbox"
              id="show-lessons"
              checked={showLessons}
              onChange={(e) => setShowLessons(e.target.checked)}
              className="w-4 h-4 rounded border-input text-brand focus:ring-brand cursor-pointer"
            />
            <label htmlFor="show-lessons" className="text-sm font-medium text-foreground/80 cursor-pointer whitespace-nowrap">
              {t('adminPages.events.list.showLessons')}
            </label>
          </div>

          {/* Weekly series: one line each, or every week on its own */}
          <div className="flex items-center gap-2 px-2 border dark:border-border rounded-md bg-muted dark:bg-secondary h-10">
            <input
              type="checkbox"
              id="group-series"
              checked={groupWeekly}
              onChange={(e) => setGroupWeekly(e.target.checked)}
              className="w-4 h-4 rounded border-input text-brand focus:ring-brand cursor-pointer"
            />
            <label htmlFor="group-series" className="text-sm font-medium text-foreground/80 cursor-pointer whitespace-nowrap">
              {t('adminPages.events.series.group')}
            </label>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-card dark:bg-card rounded-lg border dark:border-border">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground dark:text-foreground mb-2">{t('adminPages.events.list.emptyTitle')}</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedEventType !== 'all' || dateFilter !== 'all' 
                ? t('adminPages.events.list.emptyFiltered')
                : t('adminPages.events.list.emptyFirst')
              }
            </p>
            {!searchTerm && selectedEventType === 'all' && dateFilter === 'all' && (
              <Button onClick={() => navigate('/admin/events/create')}>
                <Plus className="w-4 h-4 mr-2" />
                {t('adminPages.events.createEvent')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-border">
            {/* Table Header with Select All */}
            <div className="p-4 bg-muted dark:bg-secondary border-b dark:border-border flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedEventIds.length === filteredEvents.length && filteredEvents.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-input text-brand focus:ring-brand cursor-pointer"
              />
              <span className="text-sm font-medium text-muted-foreground">
                {selectedEventIds.length > 0 
                  ? t('adminPages.events.list.selectedCount', { count: selectedEventIds.length })
                  : t('adminPages.events.list.selectAll', { count: filteredEvents.length })}
              </span>
            </div>
            {listItems.map((item) => item.kind === 'event' ? renderEventRow(item.event) : (
              <SeriesRow
                key={item.seriesId}
                title={item.title}
                total={item.total}
                upcoming={item.upcoming}
                next={item.next}
                onEditNext={() => navigate(`/admin/events/${item.next.id}/edit`)}
                onCancelUpcoming={() => { void askSeriesCancel(item.next, 'following'); }}
              >
                {item.events.map(renderEventRow)}
              </SeriesRow>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card dark:bg-card rounded-lg border dark:border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('adminPages.events.list.totalEvents')}</p>
              <p className="text-2xl font-bold text-foreground dark:text-foreground">{events.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-brand" />
          </div>
        </div>

        <div className="bg-card dark:bg-card rounded-lg border dark:border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('adminPages.events.list.classes')}</p>
              <p className="text-2xl font-bold text-brand">
                {events.filter(e => e.event_type === 'class').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-brand-subtle flex items-center justify-center">
              <span className="text-brand font-bold text-sm">{t('adminPages.events.list.classInitial')}</span>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-card rounded-lg border dark:border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('adminPages.events.list.tests')}</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {events.filter(e => e.event_type === 'weekly_test').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <span className="text-yellow-600 dark:text-yellow-400 font-bold text-sm">{t('adminPages.events.list.testInitial')}</span>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-card rounded-lg border dark:border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('adminPages.events.list.webinars')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {events.filter(e => e.event_type === 'webinar').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 font-bold text-sm">{t('adminPages.events.list.webinarInitial')}</span>
            </div>
          </div>
        </div>
      </div>

      {seriesCancel && (
        <SeriesDeleteDialog
          title={seriesCancel.event.title}
          following={seriesCancel.following}
          initialScope={seriesCancel.initialScope}
          onConfirm={confirmSeriesCancel}
          onClose={() => setSeriesCancel(null)}
        />
      )}
    </div>
  );
}
