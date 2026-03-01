import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  Repeat, 
  Save,
  X,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  createEvent, 
  updateEvent, 
  getAllGroups, 
  getCourses, 
  createCuratorEvent, 
  getCuratorGroups, 
  getCourseModules, 
  getModuleLessons,
  getUsers
} from '../services/api';
import type { Event, CreateEventRequest, UpdateEventRequest, EventType, Group, Course, CourseModule, Lesson } from '../types';
import { EVENT_TYPE_LABELS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toDatetimeLocal, fromDatetimeLocalKZ } from '../lib/datetime';

interface EventFormProps {
  event?: Event;
  onSave: (event: Event) => void;
  onCancel: () => void;
}

export default function EventForm({ event, onSave, onCancel }: EventFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourseForLesson, setSelectedCourseForLesson] = useState<string>('');
  const [selectedModuleForLesson, setSelectedModuleForLesson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Form state (display in KZ, send UTC)
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    event_type: event?.event_type || 'class' as EventType,
    start_datetime: event?.start_datetime ? toDatetimeLocal(event.start_datetime) : '',
    end_datetime: event?.end_datetime ? toDatetimeLocal(event.end_datetime) : '',
    location: event?.location || '',
    is_online: event?.is_online ?? true,
    meeting_url: event?.meeting_url || '',
    is_recurring: event?.is_recurring || false,
    recurrence_pattern: event?.recurrence_pattern || 'weekly',
    recurrence_end_date: event?.recurrence_end_date || '',
    max_participants: event?.max_participants || undefined,
    group_ids: event?.group_ids || [],
    course_ids: event?.course_ids || [],
    lesson_id: event?.lesson_id || undefined,
    teacher_id: event?.teacher_id || undefined
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      let groupsData;
      let coursesData;
      
      // Load groups based on role
      if (user?.role === 'curator') {
        // Curators only see their own groups
        groupsData = await getCuratorGroups();
      } else {
        // Admins see all groups
        groupsData = await getAllGroups();
      }
      
      // Load courses (available to all)
      coursesData = await getCourses();
      
      setGroups(groupsData.groups || groupsData);
      // Handle courses response structure
      const coursesResponse = coursesData as any;
      setCourses(Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.data || []));

      // Load teachers
      const usersData = await getUsers({ role: 'teacher' });
      const adminsData = await getUsers({ role: 'admin' });
      const curatorsData = await getUsers({ role: 'curator' });
      
      const allTeachers = [
        ...(Array.isArray(usersData) ? usersData : []),
        ...(Array.isArray(adminsData) ? adminsData : []),
        ...(Array.isArray(curatorsData) ? curatorsData : [])
      ];
      
      // Filter unique by ID
      const uniqueTeachers = Array.from(new Map(allTeachers.map(item => [item.id, item])).values());
      setTeachers(uniqueTeachers);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleGroupToggle = (groupId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      group_ids: checked 
        ? [...prev.group_ids, groupId]
        : prev.group_ids.filter(id => id !== groupId)
    }));
  };

  const handleCourseToggle = (courseId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      course_ids: checked 
        ? [...prev.course_ids, courseId]
        : prev.course_ids.filter(id => id !== courseId)
    }));
  };
  
  // Lesson linking handlers
  const handleLessonCourseChange = async (courseId: string) => {
    setSelectedCourseForLesson(courseId);
    setSelectedModuleForLesson('');
    setModules([]);
    setLessons([]);
    setFormData(prev => ({ ...prev, lesson_id: undefined }));
    
    if (courseId) {
      try {
        const modulesData = await getCourseModules(courseId);
        setModules(modulesData);
      } catch (err) {
        console.error('Failed to load modules', err);
      }
    }
  };

  const handleLessonModuleChange = async (moduleId: string) => {
    setSelectedModuleForLesson(moduleId);
    setLessons([]);
    setFormData(prev => ({ ...prev, lesson_id: undefined }));
    
    if (moduleId && selectedCourseForLesson) {
      try {
        const lessonsData = await getModuleLessons(selectedCourseForLesson, parseInt(moduleId));
        setLessons(lessonsData);
      } catch (err) {
        console.error('Failed to load lessons', err);
      }
    }
  };

  const handleLessonChange = (lessonId: string) => {
    setFormData(prev => ({ ...prev, lesson_id: parseInt(lessonId) }));
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Event title is required';
    }
    
    if (!formData.start_datetime) {
      return 'Start date and time are required';
    }
    
    if (!formData.end_datetime) {
      return 'End date and time are required';
    }
    
    const startDate = new Date(formData.start_datetime);
    const endDate = new Date(formData.end_datetime);
    
    if (startDate >= endDate) {
      return 'Start time must be before end time';
    }
    
    if (formData.group_ids.length === 0 && formData.course_ids.length === 0) {
      return 'Select at least one group or course';
    }
    
    if (formData.event_type === 'webinar' && formData.max_participants && formData.max_participants < 1) {
      return 'Maximum participants must be greater than 0';
    }

    if (formData.is_recurring && formData.recurrence_end_date) {
      const recurrenceEnd = new Date(formData.recurrence_end_date);
      const eventEnd = new Date(formData.end_datetime);
      
      if (recurrenceEnd <= eventEnd) {
        return 'Recurrence end date must be after the event end date';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const eventData: CreateEventRequest | UpdateEventRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        event_type: formData.event_type,
        start_datetime: fromDatetimeLocalKZ(formData.start_datetime),
        end_datetime: fromDatetimeLocalKZ(formData.end_datetime),
        location: formData.location.trim() || undefined,
        is_online: formData.is_online,
        meeting_url: formData.meeting_url.trim() || undefined,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : undefined,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : undefined,
        max_participants: formData.event_type === 'webinar' ? formData.max_participants : undefined,
        group_ids: formData.group_ids,
        course_ids: formData.course_ids,
        lesson_id: formData.lesson_id,
        teacher_id: formData.teacher_id
      };

      let savedEvent: Event;
      if (event) {
        savedEvent = await updateEvent(event.id, eventData);
      } else {
        // Use curator-specific endpoint for curators, admin endpoint for admins
        if (user?.role === 'curator') {
          savedEvent = await createCuratorEvent(eventData as CreateEventRequest);
        } else {
          savedEvent = await createEvent(eventData as CreateEventRequest);
        }
      }

      onSave(savedEvent);
    } catch (error: any) {
      setError(error.message || 'Ошибка при сохранении события');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {event ? 'Edit Event' : 'Create Event'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {event ? 'Make changes to the event' : 'Fill in information about the new event'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <X className="w-4 h-4 mr-2" />
          Exit
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter event title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Event description (optional)"
                rows={3}
              />
            </div>

            {/* Event Type */}
            <div>
              <Label htmlFor="event_type">Event Type *</Label>
              <Select value={formData.event_type} onValueChange={(value) => handleInputChange('event_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {EVENT_TYPE_LABELS.class}
                    </div>
                  </SelectItem>
                  <SelectItem value="weekly_test">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {EVENT_TYPE_LABELS.weekly_test}
                    </div>
                  </SelectItem>
                  <SelectItem value="webinar">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      {EVENT_TYPE_LABELS.webinar}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lesson Linking (Optional for Class events) */}
        {formData.event_type === 'class' && (
          <Card className="border-blue-100 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-400">
                <BookOpen className="w-5 h-5" />
                Link to Course Lesson (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                If this lesson corresponds to a specific item in your course catalog, you can link it here.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Course Select */}
                <div>
                  <Label htmlFor="lesson_course">Course</Label>
                  <Select 
                    value={selectedCourseForLesson} 
                    onValueChange={handleLessonCourseChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id.toString()}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Module Select */}
                <div>
                  <Label htmlFor="lesson_module">Module</Label>
                  <Select 
                    value={selectedModuleForLesson} 
                    onValueChange={handleLessonModuleChange}
                    disabled={!selectedCourseForLesson}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map(module => (
                        <SelectItem key={module.id} value={module.id.toString()}>
                          {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lesson Select */}
                <div>
                  <Label htmlFor="lesson_select">Lesson</Label>
                  <Select 
                    value={formData.lesson_id?.toString() || ''} 
                    onValueChange={handleLessonChange}
                    disabled={!selectedModuleForLesson}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select lesson" />
                    </SelectTrigger>
                    <SelectContent>
                      {lessons.map(lesson => (
                        <SelectItem key={lesson.id} value={lesson.id.toString()}>
                          {lesson.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            {/* Teacher Selection */}
            <div>
              <Label htmlFor="teacher_id">Assigned Teacher (Optional)</Label>
              <Select 
                value={formData.teacher_id?.toString() || 'none'} 
                onValueChange={(value) => handleInputChange('teacher_id', value === 'none' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.name} ({teacher.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          </Card>
        )}

        {/* Date and Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Date and Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_datetime">Start Time *</Label>
                <Input
                  id="start_datetime"
                  type="datetime-local"
                  value={formData.start_datetime}
                  onChange={(e) => handleInputChange('start_datetime', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_datetime">End Time *</Label>
                <Input
                  id="end_datetime"
                  type="datetime-local"
                  value={formData.end_datetime}
                  onChange={(e) => handleInputChange('end_datetime', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Recurring */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) => handleInputChange('is_recurring', checked)}
              />
              <Label htmlFor="is_recurring" className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Recurring Event
              </Label>
            </div>

            {formData.is_recurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <Label htmlFor="recurrence_pattern">Frequency</Label>
                  <Select 
                    value={formData.recurrence_pattern} 
                    onValueChange={(value) => handleInputChange('recurrence_pattern', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly (Every 2 weeks)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recurrence_end_date">End Date</Label>
                  <Input
                    id="recurrence_end_date"
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) => handleInputChange('recurrence_end_date', e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_online"
                checked={formData.is_online}
                onCheckedChange={(checked) => handleInputChange('is_online', checked)}
              />
              <Label htmlFor="is_online" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Online Event
              </Label>
            </div>

            <div>
              <Label htmlFor="location">
                {formData.is_online ? 'Meeting Link' : 'Location'}
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder={formData.is_online ? 'https://zoom.us/j/...' : 'Room 101'}
              />
            </div>

            {formData.is_online && (
              <div>
                <Label htmlFor="meeting_url">Additional Link</Label>
                <Input
                  id="meeting_url"
                  value={formData.meeting_url}
                  onChange={(e) => handleInputChange('meeting_url', e.target.value)}
                  placeholder="https://teams.microsoft.com/..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webinar Settings */}
        {formData.event_type === 'webinar' && (
          <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Webinar Settings
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="max_participants">Maximum Participants</Label>
                <Input
                  id="max_participants"
                  type="number"
                  min="1"
                  value={formData.max_participants || ''}
                  onChange={(e) => handleInputChange('max_participants', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="No limit"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Courses Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Courses</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Assign to all students enrolled in these courses</p>
              {courses.map(course => (
                <div key={course.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`course-${course.id}`}
                    checked={formData.course_ids.includes(parseInt(course.id))}
                    onCheckedChange={(checked) => handleCourseToggle(parseInt(course.id), checked as boolean)}
                  />
                  <Label htmlFor={`course-${course.id}`} className="flex items-center gap-2 cursor-pointer">
                    {course.title}
                    {course.teacher_name && (
                      <span className="text-xs text-gray-500">({course.teacher_name})</span>
                    )}
                  </Label>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm">No courses found</p>
              )}
            </div>
            <div className="border-t dark:border-border pt-2"></div>

            {/* Groups Selection */}
            <div className="space-y-1">
              <Label className="text-base font-semibold">Groups</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Assign to specific student groups</p>
              {groups.map(group => (
                <div key={group.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${group.id}`}
                    checked={formData.group_ids.includes(group.id)}
                    onCheckedChange={(checked) => handleGroupToggle(group.id, checked as boolean)}
                  />
                  <Label htmlFor={`group-${group.id}`} className="flex items-center gap-2 cursor-pointer">
                    {group.name}
                    <Badge variant="outline" className="text-xs">
                      {group.student_count} students
                    </Badge>
                  </Label>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-gray-500 text-sm">No groups found</p>
              )}
            </div>


          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : event ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
