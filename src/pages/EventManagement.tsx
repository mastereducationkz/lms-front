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
import { getAllEvents, deleteEvent, bulkDeleteEvents, getAllGroups } from '../services/api';
import type { Event, EventType, Group } from '../types';
import { EVENT_TYPE_LABELS } from '../types';

export default function EventManagement() {
  const navigate = useNavigate();
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

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await deleteEvent(eventId);
      setEvents(events.filter(event => event.id !== eventId));
      setSelectedEventIds(prev => prev.filter(id => id !== eventId));
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Error deleting event');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEventIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedEventIds.length} events?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const realEventIds = selectedEventIds.filter(id => !isVirtualEvent(id));
      if (realEventIds.length === 0) {
        alert("Cannot delete scheduled lessons or assignment deadlines from here.");
        return;
      }
      await bulkDeleteEvents(realEventIds);
      setEvents(events.filter(event => !realEventIds.includes(event.id)));
      setSelectedEventIds([]);
    } catch (error) {
      console.error('Failed to delete events:', error);
      alert('Error deleting events');
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
    // Search filter
    if (searchTerm && !event.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
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
    const date = new Date(dateTimeString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeColor = (eventType: EventType) => {
    const withDark: Record<EventType, string> = {
      class: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      weekly_test: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      webinar: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-400 border-red-200 dark:border-red-800',
      assignment: 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    return withDark[eventType] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
  };

  if (loading) {
    return <Loader size="xl" animation="spin" color="#2563eb" />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Event Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Create and manage group schedules</p>
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
              Delete {selectedEventIds.length} Selected
            </Button>
          )}
          <Button 
            onClick={() => navigate('/admin/events/create')}
            className="flex items-center gap-2 flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-card rounded-lg border dark:border-border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Event Type Filter */}
          <Select value={selectedEventType} onValueChange={(value) => setSelectedEventType(value as EventType | 'all')}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="class">Classes</SelectItem>
              <SelectItem value="weekly_test">Weekly Tests</SelectItem>
              <SelectItem value="webinar">Webinars</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as any)}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
            </SelectContent>
          </Select>

          {/* Group Filter */}
          <Select value={selectedGroupId.toString()} onValueChange={(value) => setSelectedGroupId(value === 'all' ? 'all' : parseInt(value))}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Lessons Toggle */}
          <div className="flex items-center gap-2 px-2 border dark:border-border rounded-md bg-gray-50 dark:bg-secondary h-10">
            <input
              type="checkbox"
              id="show-lessons"
              checked={showLessons}
              onChange={(e) => setShowLessons(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="show-lessons" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
              Show Lessons
            </label>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-white dark:bg-card rounded-lg border dark:border-border">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">No Events Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || selectedEventType !== 'all' || dateFilter !== 'all' 
                ? 'Try adjusting your search filters'
                : 'Create your first event to get started'
              }
            </p>
            {!searchTerm && selectedEventType === 'all' && dateFilter === 'all' && (
              <Button onClick={() => navigate('/admin/events/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-border">
            {/* Table Header with Select All */}
            <div className="p-4 bg-gray-50 dark:bg-secondary border-b dark:border-border flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedEventIds.length === filteredEvents.length && filteredEvents.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedEventIds.length > 0 
                  ? `${selectedEventIds.length} items selected` 
                  : `Select all events (${filteredEvents.length})`}
              </span>
            </div>
            {filteredEvents.map(event => (
              <div key={event.id} className="p-6 hover:bg-gray-50 dark:hover:bg-secondary transition-colors flex items-start gap-4">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(event.id)}
                    onChange={() => toggleSelectEvent(event.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Event Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground truncate">
                        {event.title}
                      </h3>
                      <Badge className={`${getEventTypeColor(event.event_type)} border`}>
                        {EVENT_TYPE_LABELS[event.event_type]}
                      </Badge>
                      {event.is_recurring && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          Recurring
                        </Badge>
                      )}
                      {isScheduledLesson(event.id) && (
                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                          Scheduled Lesson
                        </Badge>
                      )}
                      {isAssignmentDeadline(event.id) && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          Deadline
                        </Badge>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
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
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="font-medium">Teacher: {event.teacher_name}</span>
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
                      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-2">
                        {event.description}
                      </p>
                    )}

                    {/* Event Meta */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Created by: {event.creator_name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(event.created_at).toLocaleDateString('en-US')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                      disabled={isVirtualEvent(event.id)}
                      title={isVirtualEvent(event.id) ? "Generated events cannot be edited" : "Edit event"}
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
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/events/${event.id}/participants`)}
                        >
                          Participants
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={isVirtualEvent(event.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{events.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Classes</p>
              <p className="text-2xl font-bold text-blue-600">
                {events.filter(e => e.event_type === 'class').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">C</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tests</p>
              <p className="text-2xl font-bold text-yellow-600">
                {events.filter(e => e.event_type === 'weekly_test').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-yellow-100 flex items-center justify-center">
              <span className="text-yellow-600 font-bold text-sm">T</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Webinars</p>
              <p className="text-2xl font-bold text-red-600">
                {events.filter(e => e.event_type === 'webinar').length}
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
              <span className="text-red-600 font-bold text-sm">W</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
