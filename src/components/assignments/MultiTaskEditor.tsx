
import { useState, useEffect } from 'react';
import { Trash2, GripVertical, BookOpen, FileText, MessageSquare, Link as LinkIcon, FileSearch, Mic, Star, ClipboardList } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../Toast';
import { useT } from '../../lib/i18n/react';
import CourseUnitTaskEditor from './CourseUnitTaskEditor';
import TextTaskEditor from './TextTaskEditor';
import LinkTaskEditor from './LinkTaskEditor';
import FileUploadEditor from './FileUploadEditor';
import PdfTextTaskEditor from './PdfTextTaskEditor';
import { AnswerKeyEditor } from './AnswerKeyEditor';
import '@/lib/i18n/catalogs/teacher';
import '@/lib/i18n/catalogs/homeworkStaff';

interface Task {
  id: string;
  task_type: 'course_unit' | 'file_task' | 'text_task' | 'link_task' | 'pdf_text_task' | 'audio_task' | 'bluebook_task';
  title: string;
  description?: string;
  order_index: number;
  points: number;
  content: any;
  is_optional?: boolean; // Optional/bonus tasks give extra points
  answer_keys?: any[];
}

interface MultiTaskEditorProps {
  content: any;
  onContentChange: (content: any) => void;
  assignmentId?: string;
}

const TASK_TYPES = [
  { value: 'course_unit', label: 'homeworkStaff.taskType.courseUnit', icon: BookOpen, description: 'homeworkStaff.taskType.courseUnitHint' },
  { value: 'file_task', label: 'homeworkStaff.taskType.file', icon: FileText, description: 'homeworkStaff.taskType.fileHint' },
  { value: 'text_task', label: 'homeworkStaff.taskType.text', icon: MessageSquare, description: 'homeworkStaff.taskType.textHint' },
  { value: 'link_task', label: 'homeworkStaff.taskType.link', icon: LinkIcon, description: 'homeworkStaff.taskType.linkHint' },
  { value: 'pdf_text_task', label: 'homeworkStaff.taskType.pdfText', icon: FileSearch, description: 'homeworkStaff.taskType.pdfTextHint' },
  { value: 'audio_task', label: 'homeworkStaff.taskType.audio', icon: Mic, description: 'homeworkStaff.taskType.audioHint' },
  { value: 'bluebook_task', label: 'homeworkStaff.taskType.bluebook', icon: ClipboardList, description: 'homeworkStaff.taskType.bluebookHint' }
] as const;

// College Board publishes practice tests 4-11 in Bluebook. Enforced again server-side:
// the selector is a convenience, not a security boundary.
const BLUEBOOK_TEST_NUMBERS = [4, 5, 6, 7, 8, 9, 10, 11];

export default function MultiTaskEditor({ content, onContentChange, assignmentId }: MultiTaskEditorProps) {
  const tr = useT();
  const [tasks, setTasks] = useState<Task[]>(content.tasks || []);
  const [instructions, setInstructions] = useState(content.instructions || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (content.tasks && content.tasks.length > 0 && tasks.length === 0) {
      setTasks(content.tasks);
    }
    if (content.instructions && !instructions) {
      setInstructions(content.instructions);
    }
  }, [content.tasks, content.instructions]);

  useEffect(() => {
    // Calculate total points (required) and bonus points (optional)
    const requiredPoints = tasks
      .filter(task => !task.is_optional)
      .reduce((sum, task) => sum + (task.points || 0), 0);
    const bonusPoints = tasks
      .filter(task => task.is_optional)
      .reduce((sum, task) => sum + (task.points || 0), 0);
    const totalPoints = requiredPoints + bonusPoints;
    
    onContentChange({
      tasks,
      total_points: totalPoints,
      required_points: requiredPoints,
      bonus_points: bonusPoints,
      instructions
    });
  }, [tasks, instructions]);

  const addTask = (taskType: string) => {
    // Only one "Course Units" task is allowed per assignment. Multiple course-unit
    // tasks cause a course-resolution collision (the "Null course" bug) where one
    // of them becomes impossible to complete.
    if (taskType === 'course_unit' && tasks.some(t => t.task_type === 'course_unit')) {
      toast(tr('teacher.taskEditor.oneCourseUnitPerAssignment'), 'error');
      return;
    }

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      task_type: taskType as any,
      title: '',
      description: '',
      order_index: tasks.length,
      points: 10,
      content: {},
      is_optional: false
    };
    
    setTasks([...tasks, newTask]);
  };

  const removeTask = (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    // Update order indices
    newTasks.forEach((task, i) => {
      task.order_index = i;
    });
    setTasks(newTasks);
  };

  const updateTask = (index: number, updates: Partial<Task>) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], ...updates };
    setTasks(newTasks);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(index, 0, draggedTask);
    
    // Update order indices
    newTasks.forEach((task, i) => {
      task.order_index = i;
    });
    
    setTasks(newTasks);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const renderTaskEditor = (task: Task, index: number) => {
    switch (task.task_type) {
      case 'course_unit':
        return (
          <CourseUnitTaskEditor
            content={task.content}
            onContentChange={(content) => updateTask(index, { content })}
          />
        );
      case 'file_task':
        return (
          <FileUploadEditor
            content={task.content}
            onContentChange={(content) => updateTask(index, { content })}
          />
        );
      case 'text_task':
        return (
          <TextTaskEditor
            content={task.content}
            onContentChange={(content) => updateTask(index, { content })}
          />
        );
      case 'link_task':
        return (
          <LinkTaskEditor
            content={task.content}
            onContentChange={(content) => updateTask(index, { content })}
          />
        );
      case 'pdf_text_task':
        return (
          <PdfTextTaskEditor
            content={task.content}
            onContentChange={(content) => updateTask(index, { content })}
          />
        );
      case 'audio_task':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`audio-question-${task.id}`}>{tr('homeworkStaff.editor.questionPrompt')}</Label>
              <Textarea
                id={`audio-question-${task.id}`}
                value={task.content.question || ''}
                onChange={(e) => updateTask(index, { content: { ...task.content, question: e.target.value } })}
                placeholder={tr('homeworkStaff.multi.audioPlaceholder')}
                rows={4}
              />
              <p className="text-xs text-muted-foreground  mt-1">
                {tr('homeworkStaff.multi.audioHint')}
              </p>
            </div>
          </div>
        );
      case 'bluebook_task':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`bluebook-test-${task.id}`}>{tr('homeworkStaff.multi.bluebookTest')}</Label>
              <select
                id={`bluebook-test-${task.id}`}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={task.content.test_number ?? ''}
                onChange={(e) =>
                  updateTask(index, {
                    content: {
                      ...task.content,
                      // Stored as a number: the backend rejects a string test_number.
                      test_number: e.target.value === '' ? undefined : Number(e.target.value),
                    },
                  })
                }
              >
                <option value="">{tr('homeworkStaff.multi.bluebookSelect')}</option>
                {BLUEBOOK_TEST_NUMBERS.map((n) => (
                  <option key={n} value={n}>{tr('homeworkStaff.multi.bluebookOption', { number: n })}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground  mt-1">
                {tr('homeworkStaff.multi.bluebookHint')}
              </p>
            </div>
          </div>
        );
      default:
        return <div>{tr('homeworkStaff.multi.unknownType')}</div>;
    }
  };

  const getTaskTypeInfo = (taskType: string) => {
    return TASK_TYPES.find(t => t.value === taskType);
  };

  return (
    <div className="space-y-6">
      {/* Overall Instructions */}
      <div>
        <Label htmlFor="instructions">{tr('homeworkStaff.multi.instructions')}</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={tr('homeworkStaff.multi.instructionsPlaceholder')}
          rows={3}
        />
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{tr('homeworkStaff.multi.tasks', { count: tasks.length })}</h3>
          <div className="text-sm text-muted-foreground  flex items-center gap-4">
            <span>
              {tr('homeworkStaff.multi.required')} <span className="font-semibold text-foreground">{tr('homeworkStaff.multi.points', { count: tasks.filter(t => !t.is_optional).reduce((sum, t) => sum + t.points, 0) })}</span>
            </span>
            {tasks.some(t => t.is_optional) && (
              <span className="text-amber-600 dark:text-amber-400">
                {tr('homeworkStaff.multi.bonusTotal')} <span className="font-semibold">+{tr('homeworkStaff.multi.points', { count: tasks.filter(t => t.is_optional).reduce((sum, t) => sum + t.points, 0) })}</span>
              </span>
            )}
          </div>
        </div>

        {tasks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p>{tr('homeworkStaff.multi.empty')}</p>
            </CardContent>
          </Card>
        )}

        {tasks.map((task, index) => {
          const taskTypeInfo = getTaskTypeInfo(task.task_type);
          const Icon = taskTypeInfo?.icon || FileText;

          return (
            <Card
              key={task.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`${draggedIndex === index ? 'opacity-50' : ''} cursor-move`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    <Icon className="w-5 h-5 text-brand" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-muted-foreground">{tr('homeworkStaff.multi.taskNumber', { number: index + 1 })}</span>
                        <span className="text-xs px-2 py-1 bg-brand-subtle  text-brand-subtle-foreground  rounded">
                          {taskTypeInfo && tr(taskTypeInfo.label)}
                        </span>
                        {task.is_optional && (
                          <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {tr('homeworkStaff.multi.bonus')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => updateTask(index, { title: e.target.value })}
                        placeholder={tr('homeworkStaff.multi.taskTitlePlaceholder')}
                        className="mt-1 w-full text-base font-semibold border-none focus:outline-none focus:ring-0 p-0 bg-transparent text-foreground"
                      />
                    </div>
                    <div className="flex items-center space-x-3">
                      {/* Optional/Bonus Checkbox */}
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <Checkbox
                          checked={task.is_optional || false}
                          onCheckedChange={(checked) => updateTask(index, { is_optional: !!checked })}
                        />
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{tr('homeworkStaff.multi.bonus')}</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={task.points}
                          onChange={(e) => updateTask(index, { points: parseInt(e.target.value) || 0 })}
                          className="w-16 px-2 py-1 text-sm border rounded bg-background dark:bg-card dark:border-border"
                          min="0"
                        />
                        <span className="text-sm text-muted-foreground">{tr('homeworkStaff.multi.pointsUnit', { count: task.points })}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTask(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTaskEditor(task, index)}
                <AnswerKeyEditor
                  answerKeys={task.answer_keys || []}
                  onChange={(answer_keys) => updateTask(index, { answer_keys })}
                  assignmentId={assignmentId}
                  taskId={task.id}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Task Buttons */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <Label className="mb-3 block">{tr('homeworkStaff.multi.addTask')}</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {TASK_TYPES.map(taskType => {
              const Icon = taskType.icon;
              const isCourseUnit = taskType.value === 'course_unit';
              const courseUnitTaken = isCourseUnit && tasks.some(t => t.task_type === 'course_unit');
              return (
                <Button
                  key={taskType.value}
                  type="button"
                  variant="outline"
                  onClick={() => addTask(taskType.value)}
                  disabled={courseUnitTaken}
                  title={courseUnitTaken ? tr('teacher.taskEditor.oneCourseUnitOnly') : undefined}
                  className="flex flex-col items-center justify-center h-auto py-4 space-y-2 text-center whitespace-normal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon className="w-6 h-6 flex-shrink-0" />
                  <span className="text-sm font-medium break-words w-full">{tr(taskType.label)}</span>
                  <span className="text-xs text-muted-foreground  break-words w-full">
                    {courseUnitTaken ? tr('teacher.taskEditor.alreadyAdded') : tr(taskType.description)}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
