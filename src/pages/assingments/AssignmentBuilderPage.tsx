import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import { 
  Save, 
  Eye, 
  X,
  Trash2, 
  FileText
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';

import { DateTimePicker } from '../../components/ui/date-time-picker';
import MultiTaskEditor from '../../components/assignments/MultiTaskEditor';
import { parseAsUTC } from '../../lib/datetime';
import { prepareTeacherGroupList } from '../../lib/groupList';
import { taskUploadMessage } from '../../lib/uploadFailure';
import { createUploadCache } from '../../lib/uploadOnce';
import { formatDateTime, formatNumber } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/homeworkStaff';

interface AssignmentFormData {
  title: string;
  description: string;
  assignment_type: string;
  content: any;
  correct_answers: any;
  max_score: number;
  due_date?: string;
  allowed_file_types?: string[];
  max_file_size_mb?: number;
  group_id?: number;
  group_ids?: number[];
  event_mapping?: Record<number, number>; // group_id -> virtual event_id (for UI display only)
  lesson_number_mapping?: Record<number, number>; // group_id -> lesson_number (for backend)
  due_date_mapping?: Record<number, string>; // group_id -> ISO due date
  late_penalty_enabled?: boolean;
  late_penalty_multiplier?: number;
  max_attempts?: number | null;
}

export default function AssignmentBuilderPage() {
  const { } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const { groupId, assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  
  const [formData, setFormData] = useState<AssignmentFormData>({
    title: '',
    description: '',
    assignment_type: 'multi_task',
    content: {},
    correct_answers: {},
    max_score: 100,
    due_date: '',
    allowed_file_types: ['pdf', 'docx', 'doc', 'jpg', 'png'],
    max_file_size_mb: 10,
    group_ids: [],
    event_mapping: {},
    lesson_number_mapping: {},
    due_date_mapping: {},
    late_penalty_enabled: false,
    late_penalty_multiplier: 0.6,
    max_attempts: 1
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [eventsByGroup, setEventsByGroup] = useState<Record<number, any[]>>({}); // Cache events per group
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadGroups();
    if (groupId) {
      setFormData(prev => ({
        ...prev,
        group_id: parseInt(groupId),
        group_ids: [parseInt(groupId)]
      }));
    }
  }, [groupId]);

  // Ensure the "Link to Class" list is loaded for every selected group, however it was
  // selected — a deep link (/homework/new/group/:id) or edit/copy sets group_ids
  // programmatically, without going through handleGroupToggle. loadEventsForGroup is
  // idempotent (it skips groups already cached), so this is safe to run on any change.
  useEffect(() => {
    (formData.group_ids || []).forEach((gid: number) => loadEventsForGroup(gid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.group_ids]);

  useEffect(() => {
    if (assignmentId) {
      setIsEditing(true);
      loadAssignment(assignmentId);
    } else if (copyFromId) {
      setIsEditing(false);
      loadAssignment(copyFromId);
    }
  }, [assignmentId, copyFromId]);

  // A copy preselects its source group, which may be archived and therefore absent
  // from the picker — the teacher can neither see nor deselect it, and class-link
  // validation would demand a pick for an invisible group. Once the teacher's group
  // list is loaded, drop selected groups that aren't in it (create/copy only; edits
  // keep their group even if it has since been archived).
  useEffect(() => {
    if (isEditing || groupsLoading || groups.length === 0) return;
    setFormData(prev => {
      const visible = new Set(groups.map((g: any) => g.id));
      const pruned = (prev.group_ids || []).filter(gid => visible.has(gid));
      if (pruned.length === (prev.group_ids || []).length) return prev;
      return { ...prev, group_ids: pruned, group_id: pruned[0] };
    });
    // formData.group_ids in deps: loadAssignment may set the source group AFTER groups load.
  }, [groups, groupsLoading, isEditing, formData.group_ids]);

  const loadAssignment = async (id: string) => {
    try {
      setLoading(true);
      const assignment = await apiClient.getAssignment(id);
      console.log('Loaded assignment:', assignment);
      
      // Parse content if it's a string
      let content = assignment.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse content:', e);
        }
      }

      // Parse correct_answers if it's a string
      let correct_answers = assignment.correct_answers;
      if (typeof correct_answers === 'string') {
        try {
          correct_answers = JSON.parse(correct_answers);
        } catch (e) {
          console.error('Failed to parse correct_answers:', e);
        }
      }

      setFormData({
        title: copyFromId ? t('homeworkStaff.builder.copyOf', { title: assignment.title }) : assignment.title,
        description: assignment.description || '',
        assignment_type: assignment.assignment_type,
        content: content || {},
        correct_answers: correct_answers || {},
        max_score: assignment.max_score,
        // A copy targets different lessons than its source, so drop the source's
        // link data (it is keyed by the source group) and make the teacher pick anew.
        due_date: !copyFromId && assignment.due_date
          ? parseAsUTC(assignment.due_date).toISOString()
          : '',
        allowed_file_types: assignment.allowed_file_types || ['pdf', 'docx', 'doc', 'jpg', 'png'],
        max_file_size_mb: assignment.max_file_size_mb || 10,
        group_id: assignment.group_id,
        group_ids: assignment.group_id ? [assignment.group_id] : [],
        event_mapping: {},
        lesson_number_mapping: !copyFromId && assignment.lesson_number && assignment.group_id
          ? { [assignment.group_id]: assignment.lesson_number }
          : {},
        due_date_mapping: !copyFromId && assignment.due_date && assignment.group_id
          ? { [assignment.group_id]: parseAsUTC(assignment.due_date).toISOString() }
          : {},
        late_penalty_enabled: assignment.late_penalty_enabled || false,
        late_penalty_multiplier: assignment.late_penalty_multiplier || 0.6
        ,max_attempts: assignment.max_attempts ?? null
      });

      if (assignment.group_id) {
          loadEventsForGroup(assignment.group_id);
      }
    } catch (err) {
      console.error('Failed to load assignment:', err);
      setError(t('homeworkStaff.builder.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      console.log('Loading teacher groups...');
      
      const teacherGroups = await apiClient.getTeacherGroups();
      console.log('Loaded teacher groups:', teacherGroups);

      setGroups(prepareTeacherGroupList(teacherGroups || []));
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError(t('homeworkStaff.builder.loadGroupsError'));
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadEventsForGroup = async (groupId: number) => {
      if (eventsByGroup[groupId]) return; // Already loaded

      try {
          console.log(`Loading class events for group ${groupId}`);
          
          const eventsData = await apiClient.getGroupSchedules(groupId, 4, 4);
          
          console.log(`Class events for group ${groupId}:`, eventsData);
          
          setEventsByGroup(prev => ({ ...prev, [groupId]: eventsData }));
      } catch (error) {
          console.error(`Failed to load events for group ${groupId}:`, error);
      }
  };

  const handleInputChange = (field: keyof AssignmentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGroupToggle = (groupId: number, checked: boolean) => {
    setFormData(prev => {
      const currentGroups = prev.group_ids || [];
      const newGroups = checked 
        ? Array.from(new Set([...currentGroups, groupId]))
        : currentGroups.filter(id => id !== groupId);
      
      if (checked) {
          loadEventsForGroup(groupId);
      }
      
      return {
        ...prev,
        group_ids: newGroups,
        // Keep group_id for backward compatibility if needed, or just use the first one
        group_id: newGroups.length > 0 ? newGroups[0] : undefined
      };
    });
  };

  const handleGroupDueDateChange = (groupId: number, date: string) => {
      setFormData(prev => ({
          ...prev,
          due_date_mapping: {
              ...prev.due_date_mapping,
              [groupId]: date
          }
      }));
  };


  const handleEventMappingChange = (groupId: number, virtualEventId: number) => {
      // Find the selected event to get its datetime and lesson_number
      const selectedEvent = eventsByGroup[groupId]?.find((e: any) => e.id === virtualEventId);
      console.log('handleEventMappingChange:', { groupId, virtualEventId, selectedEvent, lesson_number: selectedEvent?.lesson_number });
      
      setFormData(prev => {
          const updates: any = {
              event_mapping: {
                  ...prev.event_mapping,
                  // Store event ID for UI display
                  [groupId]: virtualEventId
              }
          };
          
          // Store lesson_number for backend
          if (selectedEvent && selectedEvent.lesson_number) {
              updates.lesson_number_mapping = {
                  ...prev.lesson_number_mapping,
                  [groupId]: selectedEvent.lesson_number
              };
              console.log('Setting lesson_number_mapping:', updates.lesson_number_mapping);
          }
          
          // Auto-populate due_date_mapping when an event is selected (scheduled_at is UTC with Z)
          if (selectedEvent && selectedEvent.scheduled_at) {
              const eventDateTime = parseAsUTC(selectedEvent.scheduled_at).toISOString();

              updates.due_date_mapping = {
                  ...prev.due_date_mapping,
                  [groupId]: eventDateTime
              };
              
              // Also update the global due_date if it's not set
              if (!prev.due_date) {
                  updates.due_date = eventDateTime;
              }
          }
          
          return { ...prev, ...updates };
      });
  };

  // Deep link from the attendance leaderboard: /homework/new/group/:groupId?lesson_number=N
  // pre-selects the matching class once that group's events load, which also fills
  // lesson_number_mapping and the due date. Runs once; no match → teacher picks manually.
  const lessonNumberParam = searchParams.get('lesson_number');
  const lessonPrefillDone = useRef(false);
  // Files already uploaded while this form is open: pressing Save again re-sends only what failed.
  const uploadedFiles = useRef(createUploadCache());
  useEffect(() => {
      if (lessonPrefillDone.current || !groupId || !lessonNumberParam) return;
      const gid = parseInt(groupId);
      const events = eventsByGroup[gid];
      if (!events || events.length === 0) return;
      lessonPrefillDone.current = true;
      const target = events.find((e: any) => e.lesson_number === parseInt(lessonNumberParam));
      if (target) {
          handleEventMappingChange(gid, target.id);
      }
  }, [eventsByGroup, groupId, lessonNumberParam]);

  const handleTypeChange = (newType: string) => {
    setFormData(prev => ({
      ...prev,
      assignment_type: newType,
      // Reset content since each type expects a different content shape.
      content: {},
      correct_answers: {}
    }));
  };

  const handleContentChange = (content: any) => {
    setFormData(prev => {
      const updates: any = { content };
      
      // If multi-task, update max_score from total_points
      if (prev.assignment_type === 'multi_task' && content.total_points !== undefined) {
        updates.max_score = content.total_points;
      }
      
      return { ...prev, ...updates };
    });
  };

  const handleCorrectAnswersChange = (correct_answers: any) => {
    setFormData(prev => ({ ...prev, correct_answers }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.group_ids || formData.group_ids.length === 0) {
      setError(t('homeworkStaff.builder.selectGroup'));
      setLoading(false);
      return;
    }

    // Linking homework to a class is mandatory: the link is what gives students a
    // due date. On edit, an already-linked group (existing lesson/due date) is fine.
    const groupsMissingLink = (formData.group_ids || []).filter(gid => {
      if (formData.event_mapping?.[gid]) return false;
      if (isEditing && (formData.lesson_number_mapping?.[gid] || formData.due_date_mapping?.[gid])) return false;
      return true;
    });
    if (groupsMissingLink.length > 0) {
      const names = groupsMissingLink
        .map(gid => groups.find(g => g.id === gid)?.name || t('homeworkStaff.builder.groupFallback', { id: gid }))
        .join(', ');
      setError(t('homeworkStaff.builder.pickClassFor', { names }));
      setLoading(false);
      return;
    }

    try {
      // Handle file uploads based on assignment type
      let finalContent = { ...formData.content };

      if (formData.assignment_type === 'multi_task' && formData.content.tasks) {
        // Handle multi-task file uploads
        const updatedTasks = await Promise.all(formData.content.tasks.map(async (task: any, taskIndex: number) => {
          // Handle file_task
          if (task.task_type === 'file_task' && task.content.teacher_file instanceof File) {
            try {
              console.log(`Uploading teacher file for task ${task.id}:`, task.content.teacher_file.name);
              const uploadResult = await uploadedFiles.current.upload(task.content.teacher_file, (f) => apiClient.uploadTeacherFile(f));
              
              return {
                ...task,
                content: {
                  ...task.content,
                  teacher_file_url: uploadResult.file_url || uploadResult.url,
                  teacher_file_name: task.content.teacher_file_name || task.content.teacher_file.name,
                  teacher_file: undefined // Remove File object
                }
              };
            } catch (err) {
              console.error(`Failed to upload file for task ${task.id}:`, err);
              throw new Error(taskUploadMessage(taskIndex, task.title, err));
            }
          } else if (task.task_type === 'file_task') {
             // Ensure teacher_file is removed if it's not a File object (e.g. null or empty object)
             // and preserve existing url
             const { teacher_file, ...restContent } = task.content;
             return {
               ...task,
               content: restContent
             };
          }
          
          // Handle pdf_text_task
          if (task.task_type === 'pdf_text_task' && task.content.teacher_file instanceof File) {
            try {
              console.log(`Uploading PDF file for task ${task.id}:`, task.content.teacher_file.name);
              const uploadResult = await uploadedFiles.current.upload(task.content.teacher_file, (f) => apiClient.uploadTeacherFile(f));
              
              return {
                ...task,
                content: {
                  ...task.content,
                  teacher_file_url: uploadResult.file_url || uploadResult.url,
                  teacher_file_name: task.content.teacher_file_name || task.content.teacher_file.name,
                  teacher_file: undefined // Remove File object
                }
              };
            } catch (err) {
              console.error(`Failed to upload PDF for task ${task.id}:`, err);
              throw new Error(taskUploadMessage(taskIndex, task.title, err));
            }
          } else if (task.task_type === 'pdf_text_task') {
             // Ensure teacher_file is removed if it's not a File object
             // and preserve existing url
             const { teacher_file, ...restContent } = task.content;
             return {
               ...task,
               content: restContent
             };
          }
          
          return task;
        }));

        const tasksWithAnswerKeyFiles = await Promise.all(updatedTasks.map(async (task: any) => {
          const answer_keys = await Promise.all((task.answer_keys || []).map(async (answerKey: any) => {
            const resources = await Promise.all((answerKey.resources || []).map(async (resource: any) => {
              if (!(resource.file instanceof File)) return resource;
              const uploaded = await uploadedFiles.current.upload(resource.file, (f) => apiClient.uploadTeacherFile(f));
              const { file, ...persisted } = resource;
              return { ...persisted, file_url: uploaded.file_url || uploaded.url, file_name: resource.file.name };
            }));
            return { ...answerKey, resources };
          }));
          return { ...task, answer_keys };
        }));
        finalContent = {
          ...finalContent,
          tasks: tasksWithAnswerKeyFiles
        };

      } else {
        // Handle single file upload (legacy or if switched back)
        let teacherFileUrl = formData.content.teacher_file_url;
        let teacherFileName = formData.content.teacher_file_name;
        
        if (formData.content.teacher_file instanceof File) {
          try {
            console.log('Uploading teacher file:', formData.content.teacher_file.name);
            const uploadResult = await uploadedFiles.current.upload(formData.content.teacher_file, (f) => apiClient.uploadTeacherFile(f));
            teacherFileUrl = uploadResult.file_url || uploadResult.url;
            teacherFileName = formData.content.teacher_file_name || formData.content.teacher_file.name;
          } catch (fileError) {
            console.error('Failed to upload teacher file:', fileError);
            setError(fileError instanceof Error ? fileError.message : t('homeworkStaff.builder.uploadError'));
            setLoading(false);
            return;
          }
        }

        finalContent = {
          ...finalContent,
          teacher_file_url: teacherFileUrl,
          teacher_file_name: teacherFileName,
          teacher_file: undefined
        };
      }

      // Create assignment data
      // Use lesson_number_mapping for linking homework to lessons
      const lesson_number_mapping_final: Record<number, number> = {};
      if (formData.lesson_number_mapping) {
        Object.entries(formData.lesson_number_mapping).forEach(([groupIdStr, lessonNumber]) => {
          const groupId = parseInt(groupIdStr);
          if (lessonNumber) {
            lesson_number_mapping_final[groupId] = lessonNumber;
          }
        });
      }

      const assignmentData = {
        title: formData.title,
        description: formData.description,
        assignment_type: formData.assignment_type,
        content: finalContent,
        correct_answers: formData.correct_answers,
        max_score: formData.max_score,
        time_limit_minutes: undefined, // Add if you have this field in form
        due_date: formData.due_date || undefined,
        allowed_file_types: formData.allowed_file_types || [],
        max_file_size_mb: formData.max_file_size_mb || 10,
        group_id: formData.group_ids && formData.group_ids.length > 0 ? formData.group_ids[0] : undefined, // Legacy support
        group_ids: formData.group_ids,
        // Persist the class link itself — the backend materializes virtual event ids
        // and stores event_id, so the link survives beyond the derived due date.
        event_mapping: Object.keys(formData.event_mapping || {}).reduce((acc, gid) => {
            const eid = formData.event_mapping?.[parseInt(gid)];
            if (eid) acc[parseInt(gid)] = eid;
            return acc;
        }, {} as Record<number, number>),
        lesson_number_mapping: lesson_number_mapping_final, // lesson_number for linking homework to lessons
        due_date_mapping: Object.keys(formData.due_date_mapping || {}).reduce((acc, gid) => {
            const date = formData.due_date_mapping?.[parseInt(gid)];
            if (date) acc[parseInt(gid)] = date;
            return acc;
        }, {} as Record<number, string>),
        late_penalty_enabled: formData.late_penalty_enabled,
        late_penalty_multiplier: formData.late_penalty_multiplier,
        max_attempts: formData.max_attempts
      };
      
      console.log('Submitting assignment with data:', assignmentData);
      
      if (isEditing && assignmentId) {
        await apiClient.updateAssignment(assignmentId, assignmentData);
      } else {
        await apiClient.createAssignment(assignmentData);
      }
      
      // Redirect to assignments list
      navigate('/homework');
    } catch (err: any) {
      setError(err.message || t(isEditing ? 'homeworkStaff.builder.updateError' : 'homeworkStaff.builder.createError'));
      console.error(`Failed to ${isEditing ? 'update' : 'create'} assignment:`, err);
    } finally {
      setLoading(false);
    }
  };

  const renderAssignmentTypeEditor = () => {
    if (formData.assignment_type === 'multi_task') {
      return <MultiTaskEditor
        content={formData.content}
        onContentChange={handleContentChange}
        assignmentId={isEditing ? assignmentId : undefined}
      />;
    }

    if (formData.assignment_type === 'audio') {
      return <AudioAssignmentEditor
        content={formData.content}
        onContentChange={handleContentChange}
      />;
    }

    return <FileUploadEditor
      content={formData.content}
      correct_answers={formData.correct_answers}
      onContentChange={handleContentChange}
      onCorrectAnswersChange={handleCorrectAnswersChange}
    />;
  };

  const renderPreview = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('homeworkStaff.builder.preview')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">{formData.title || t('homeworkStaff.builder.untitled')}</h4>
            <p className="text-muted-foreground">{formData.description || t('homeworkStaff.builder.noDescription')}</p>
          </div>
          {renderAssignmentTypeEditor()}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-foreground">
            {isEditing ? t('homeworkStaff.builder.titleEdit') : copyFromId ? t('homeworkStaff.builder.titleCopy') : t('homeworkStaff.builder.titleCreate')}
          </h1>
          <p className="text-muted-foreground  mt-1">
            {isEditing ? t('homeworkStaff.builder.subtitleEdit') : t('homeworkStaff.builder.subtitleCreate')}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setPreviewMode(!previewMode)}
            variant={previewMode ? "default" : "outline"}
          >
            <Eye className="w-4 h-4 mr-2" />
            {previewMode ? t('common.edit') : t('homeworkStaff.builder.preview')}
          </Button>
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
          >
            <X className="w-4 h-4 mr-2" />
            {t('common.cancel')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <X className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-400">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="@3xl:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('homeworkStaff.builder.basicInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">
                    {t('homeworkStaff.builder.titleLabel')}
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder={t('homeworkStaff.builder.titlePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">
                    {t('homeworkStaff.builder.description')}
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={t('homeworkStaff.builder.descriptionPlaceholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="homework-type">
                    {t('homeworkStaff.builder.type')}
                  </Label>
                  <Select
                    value={formData.assignment_type}
                    onValueChange={handleTypeChange}
                    disabled={isEditing && formData.assignment_type !== 'multi_task' && formData.assignment_type !== 'audio'}
                  >
                    <SelectTrigger id="homework-type">
                      <SelectValue placeholder={t('homeworkStaff.builder.typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multi_task">{t('homeworkStaff.builder.typeMulti')}</SelectItem>
                      <SelectItem value="audio">{t('homeworkStaff.builder.typeAudio')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.assignment_type === 'audio' && (
                    <p className="text-xs text-muted-foreground  mt-1">
                      {t('homeworkStaff.builder.audioTypeHint')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Assignment Content */}
            {!previewMode && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('homeworkStaff.builder.content')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderAssignmentTypeEditor()}
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {previewMode && renderPreview()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assignment Context */}
            <Card>
              <CardHeader>
                <CardTitle>{t('homeworkStaff.builder.context')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">
                    {t('homeworkStaff.builder.groups')}
                  </Label>
                  {groupsLoading ? (
                    <div className="text-sm text-muted-foreground">{t('homeworkStaff.builder.loadingGroups')}</div>
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground  mt-1">
                      {t('homeworkStaff.builder.noGroups')}
                    </p>
                  ) : (
                    <div className="space-y-2 border dark:border-border rounded-md p-4 max-h-60 overflow-y-auto bg-card">
                      {groups.map(group => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`group-${group.id}`}
                            checked={formData.group_ids?.includes(group.id)}
                            onCheckedChange={(checked) => handleGroupToggle(group.id, checked as boolean)}
                          />
                          <Label 
                            htmlFor={`group-${group.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {group.name} <span className="text-xs text-muted-foreground">{t('homeworkStaff.builder.groupStudents', { count: group.student_count || 0 })}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground  mt-2">
                    {t('homeworkStaff.builder.selectedGroups', { count: formData.group_ids?.length || 0 })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t('homeworkStaff.builder.settings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="max-score">
                    {t('homeworkStaff.builder.maxScore')}
                  </Label>
                  <Input
                    id="max-score"
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => handleInputChange('max_score', parseInt(e.target.value))}
                    min="1"
                    max="1000"
                    required
                  />
                </div>


                {/* Late Penalty Settings */}
                <div className="pt-4 border-t space-y-3">
                  <Label>{t('homeworkStaff.builder.resubmissions')}</Label>
                  <Select
                    value={formData.max_attempts == null ? 'unlimited' : 'fixed'}
                    onValueChange={(value) => handleInputChange('max_attempts', value === 'unlimited' ? null : Math.max(1, formData.max_attempts || 1))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlimited">{t('homeworkStaff.builder.attemptsUnlimited')}</SelectItem>
                      <SelectItem value="fixed">{t('homeworkStaff.builder.attemptsFixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.max_attempts != null && (
                    <Input type="number" min="1" value={formData.max_attempts}
                      onChange={(e) => handleInputChange('max_attempts', Math.max(1, parseInt(e.target.value) || 1))} />
                  )}
                  <p className="text-xs text-muted-foreground">{t('homeworkStaff.builder.attemptsHint')}</p>
                </div>

                {/* Late Penalty Settings */}
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="late-penalty"
                      checked={formData.late_penalty_enabled}
                      onCheckedChange={(checked) => handleInputChange('late_penalty_enabled', checked)}
                    />
                    <Label htmlFor="late-penalty" className="cursor-pointer">
                      {t('homeworkStaff.builder.latePenalty')}
                    </Label>
                  </div>
                  
                  {formData.late_penalty_enabled && (
                    <div className="pl-6">
                      <Label htmlFor="penalty-multiplier" className="text-xs text-muted-foreground  mb-1 block">
                        {t('homeworkStaff.builder.penaltyMultiplier')}
                      </Label>
                      <Input
                        id="penalty-multiplier"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={formData.late_penalty_multiplier}
                        onChange={(e) => handleInputChange('late_penalty_multiplier', parseFloat(e.target.value))}
                        placeholder="0.6"
                      />
                    </div>
                  )}
                </div>

                {/* Class Event Linking Section */}
                {(formData.group_ids || []).length > 0 && (
                    <div className="pt-4 border-t space-y-4">
                      <Label className="text-sm font-semibold">{t('homeworkStaff.builder.linkToClass')}</Label>
                      <div className="space-y-3">
                          {(formData.group_ids || []).map(groupId => {
                              const group = groups.find(g => g.id === groupId);
                              const groupEvents = eventsByGroup[groupId] || [];
                              const selectedEventId = formData.event_mapping?.[groupId] || '';
                              const groupDueDate = formData.due_date_mapping?.[groupId];
                              const existingLessonNumber = formData.lesson_number_mapping?.[groupId];
                              const hasExistingLink = isEditing && !selectedEventId && (existingLessonNumber || groupDueDate);

                              return (
                                  <div key={groupId} className="p-3 border rounded-lg bg-card dark:border-border space-y-4">
                                      <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-foreground" title={group?.name}>
                                            {group?.name}
                                          </span>
                                      </div>
                                      <div className="space-y-4">
                                          {/* Class Event Selection */}
                                          <div className="space-y-1.5">
                                            <Select
                                                value={selectedEventId ? selectedEventId.toString() : ""}
                                                onValueChange={(value) => {
                                                    handleEventMappingChange(groupId, parseInt(value));
                                                }}
                                            >
                                              <SelectTrigger className="w-full bg-muted dark:bg-secondary border-border h-9 text-xs">
                                                <SelectValue placeholder={t('homeworkStaff.builder.pickClass')} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {groupEvents
                                                  .filter((event: any) => !event.is_past && parseAsUTC(event.scheduled_at) >= new Date())
                                                  .map((event: any) => (
                                                    <SelectItem 
                                                      key={event.id} 
                                                      value={event.id.toString()}
                                                    >
                                                        {t('homeworkStaff.builder.classOption', { title: event.title, date: formatDateTime(event.scheduled_at, { 
                                                            weekday: 'short', 
                                                            month: 'short', 
                                                            day: 'numeric', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit',
                                                            hour12: false
                                                        }) })}
                                                    </SelectItem>
                                                  ))}
                                              </SelectContent>
                                            </Select>

                                            {hasExistingLink && (
                                              <p className="text-[11px] text-muted-foreground pl-0.5">
                                                {(() => {
                                                  const due = groupDueDate ? formatDateTime(groupDueDate, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                                                  return existingLessonNumber && due
                                                    ? t('homeworkStaff.builder.linkedLessonDue', { lesson: existingLessonNumber, date: due })
                                                    : existingLessonNumber
                                                      ? t('homeworkStaff.builder.linkedLesson', { lesson: existingLessonNumber })
                                                      : t('homeworkStaff.builder.linkedDue', { date: due });
                                                })()}{' '}
                                                {t('homeworkStaff.builder.changeLinkHint')}
                                              </p>
                                            )}

                                            {Number(selectedEventId) > 0 && (
                                              <div className="pl-2 pt-1.5 space-y-1.5 border-l-2 border-brand">
                                                <Label className="text-[10px] text-brand  uppercase font-bold tracking-tight">{t('homeworkStaff.builder.groupDeadline')}</Label>
                                                <DateTimePicker
                                                    date={groupDueDate ? parseAsUTC(groupDueDate) : undefined}
                                                    setDate={(date) => handleGroupDueDateChange(groupId, date ? date.toISOString() : '')}
                                                    placeholder={t('homeworkStaff.builder.groupDeadlinePlaceholder')}
                                                />
                                              </div>
                                            )}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                    </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  type="submit"
                  disabled={loading || !formData.group_ids || formData.group_ids.length === 0}
                  className="w-full"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEditing ? t('homeworkStaff.builder.update') : t('homeworkStaff.builder.create')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

function AudioAssignmentEditor({
  content,
  onContentChange
}: {
  content: any;
  onContentChange: (content: any) => void;
}) {
  const t = useT();
  const [question, setQuestion] = useState(content.question || '');

  // Sync state with props when content loads asynchronously (e.g. editing an existing assignment).
  useEffect(() => {
    if (content.question && !question) setQuestion(content.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    onContentChange({ question });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="question-audio">{t('homeworkStaff.audio.prompt')}</Label>
        <Textarea
          id="question-audio"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('homeworkStaff.audio.promptPlaceholder')}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('homeworkStaff.audio.hint')}
      </p>
    </div>
  );
}

// Editor Components
interface EditorProps {
  content: any;
  correct_answers: any;
  onContentChange: (content: any) => void;
  onCorrectAnswersChange: (correct_answers: any) => void;
}

function FileUploadEditor({ content, onContentChange, onCorrectAnswersChange }: EditorProps) {
  const t = useT();
  const [question, setQuestion] = useState(content.question || '');
  const [allowedTypes, setAllowedTypes] = useState(content.allowed_file_types || ['pdf', 'docx']);
  const [maxSize, setMaxSize] = useState(content.max_file_size_mb || 10);
  const [teacherFile, setTeacherFile] = useState<File | null>(content.teacher_file || null);
  const [teacherFileName, setTeacherFileName] = useState(content.teacher_file_name || '');

  // Sync state with props when content loads asynchronously
  useEffect(() => {
    if (content.question && !question) setQuestion(content.question);
    if (content.allowed_file_types && content.allowed_file_types.length > 0 && allowedTypes.length === 2 && allowedTypes.includes('pdf')) {
       setAllowedTypes(content.allowed_file_types);
    }
    if (content.max_file_size_mb && maxSize === 10) setMaxSize(content.max_file_size_mb);
    if (content.teacher_file_name && !teacherFileName) setTeacherFileName(content.teacher_file_name);
  }, [content]);

  useEffect(() => {
    onContentChange({ 
      question, 
      allowed_file_types: allowedTypes, 
      max_file_size_mb: maxSize,
      teacher_file: teacherFile,
      teacher_file_name: teacherFileName,
      answer_fields: content.answer_fields || []
    });
    // Sync answer_fields to correct_answers for backend auto-check
    const answerFieldsData = (content.answer_fields || []).reduce((acc: any, field: any) => {
      acc[field.id] = field.correct_answer;
      return acc;
    }, {});
    onCorrectAnswersChange({ 
      requires_file: true,
      answer_fields: answerFieldsData
    });
  }, [question, allowedTypes, maxSize, teacherFile, teacherFileName, content.answer_fields]);

  const fileTypes = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'DOCX' },
    { value: 'doc', label: 'DOC' },
    { value: 'jpg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
    { value: 'gif', label: 'GIF' },
    { value: 'txt', label: 'TXT' }
  ];

  const toggleFileType = (type: string) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter((t: string) => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  const handleTeacherFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTeacherFile(file);
      setTeacherFileName(file.name);
    }
  };

  const removeTeacherFile = () => {
    setTeacherFile(null);
    setTeacherFileName('');
  };

  const uniqueId = `teacher-file-local-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="question-fu">{t('homeworkStaff.legacy.question')}</Label>
        <Textarea
          id="question-fu"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('homeworkStaff.legacy.questionPlaceholder')}
        />
      </div>

      <div>
        <Label className="mb-2">{t('homeworkStaff.legacy.teacherFile')}</Label>
        <div className="space-y-2">
          {content.teacher_file_url ? (
            // Display existing uploaded file
            <div className="flex items-center justify-between p-3 border rounded-lg bg-brand-surface  border-brand-border">
              <div className="flex items-center space-x-2 flex-1">
                <FileText className="w-4 h-4 text-brand" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-brand-surface-foreground">{content.teacher_file_name || t('homeworkStaff.editor.referenceFile')}</span>
                  <a 
                    href={content.teacher_file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-brand  hover:underline"
                  >
                    {t('homeworkStaff.editor.viewDownloadFile')}
                  </a>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onContentChange({
                    ...content,
                    teacher_file_url: null,
                    teacher_file_name: null,
                    teacher_file: null
                  });
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : teacherFile ? (
            <div className="flex items-center justify-between p-3 border dark:border-border rounded-lg bg-muted dark:bg-secondary">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-brand" />
                <span className="text-sm font-medium text-foreground">{teacherFileName}</span>
                <span className="text-xs text-muted-foreground">
                  {t('homeworkStaff.editor.fileSize', { size: formatNumber(teacherFile.size / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeTeacherFile}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border  rounded-lg p-6 text-center">
              <input
                type="file"
                id={uniqueId}
                onChange={handleTeacherFileUpload}
                className="hidden"
                accept={fileTypes.map(type => `.${type.value}`).join(',')}
              />
              <label htmlFor={uniqueId} className="cursor-pointer">
                <div className="flex flex-col items-center space-y-2">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium text-brand  hover:text-brand">
                      {t('homeworkStaff.legacy.upload')}
                    </span>
                    <p className="text-xs text-muted-foreground  mt-1">
                      {t('homeworkStaff.editor.supported', { types: fileTypes.map(type => type.label).join(', ') })}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-2">{t('homeworkStaff.editor.allowedTypes')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {fileTypes.map(type => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                checked={allowedTypes.includes(type.value)}
                onCheckedChange={() => toggleFileType(type.value)}
              />
              <Label className="text-sm">{type.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="max-size">{t('homeworkStaff.editor.maxFileSize')}</Label>
        <Input
          id="max-size"
          type="number"
          value={maxSize}
          onChange={(e) => setMaxSize(parseInt(e.target.value))}
          min="1"
          max="100"
        />
      </div>

      {/* Answer Fields for Auto-Check */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">{t('homeworkStaff.legacy.answerFields')}</Label>
            <p className="text-xs text-muted-foreground  mt-0.5">
              {t('homeworkStaff.legacy.answerFieldsHint')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newFields = [...(content.answer_fields || [])];
              newFields.push({ 
                id: Date.now(), 
                label: t('homeworkStaff.legacy.problemLabel', { number: newFields.length + 1 }), 
                correct_answer: '' 
              });
              onContentChange({ ...content, answer_fields: newFields });
            }}
          >
            + {t('homeworkStaff.answerFields.add')}
          </Button>
        </div>
        
        {(content.answer_fields || []).length > 0 && (
          <div className="space-y-3">
            {(content.answer_fields || []).map((field: any, index: number) => (
              <div key={field.id} className="flex items-start gap-2 p-3 bg-muted dark:bg-secondary rounded-lg border dark:border-border">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={t('homeworkStaff.legacy.fieldLabelPlaceholder')}
                    value={field.label}
                    onChange={(e) => {
                      const updated = [...content.answer_fields];
                      updated[index] = { ...field, label: e.target.value };
                      onContentChange({ ...content, answer_fields: updated });
                    }}
                    className="text-sm"
                  />
                  <Input
                    placeholder={t('homeworkStaff.legacy.correctAnswer')}
                    value={field.correct_answer}
                    onChange={(e) => {
                      const updated = [...content.answer_fields];
                      updated[index] = { ...field, correct_answer: e.target.value };
                      onContentChange({ ...content, answer_fields: updated });
                    }}
                    className="text-sm font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const updated = content.answer_fields.filter((_: any, i: number) => i !== index);
                    onContentChange({ ...content, answer_fields: updated });
                  }}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
