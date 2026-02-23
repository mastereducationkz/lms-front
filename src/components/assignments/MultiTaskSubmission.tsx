import { useState, useEffect } from 'react';
import { BookOpen, FileText, MessageSquare, Link as LinkIcon, CheckCircle, ExternalLink, Upload, X, FileSearch, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import apiClient from '../../services/api';
import { toast } from '../Toast';
import { compressImage } from '../../utils/imageCompression';

interface Task {
  id: string;
  task_type: 'course_unit' | 'file_task' | 'text_task' | 'link_task' | 'pdf_text_task';
  title: string;
  description?: string;
  order_index: number;
  points: number;
  content: any;
  is_optional?: boolean; // Optional/bonus tasks give extra points
}

interface MultiTaskSubmissionProps {
  assignment: any;
  onSubmit: (answers: any) => void;
  initialAnswers?: any;
  readOnly?: boolean;
  isSubmitting?: boolean;
  studentId?: string;
}

// Course Unit Task Display Component
interface CourseUnitTaskDisplayProps {
  task: Task;
  isCompleted: boolean;
  onCompletion: (completed: boolean) => void;
  readOnly: boolean;
  studentId?: string;
}

function CourseUnitTaskDisplay({ task, isCompleted, onCompletion, readOnly, studentId }: CourseUnitTaskDisplayProps) {
  const [courseData, setCourseData] = useState<any>(null);
  const [lessonsData, setLessonsData] = useState<any[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchCourseAndLessons = async () => {
    try {
      
      // Fetch course details
      const course = await apiClient.getCourse(task.content.course_id);
      setCourseData(course);
      
      // Fetch all lessons for the course
      // Pass studentId if provided, or 'me' if student is viewing their own assignment
      const fetchStudentId = studentId || (!readOnly ? 'me' : undefined);
      
      const modules = await apiClient.getCourseModules(task.content.course_id, true, fetchStudentId);
      
      const allLessons: any[] = [];
      
      modules.forEach((module: any) => {
        if (module.lessons) {
          allLessons.push(...module.lessons);
        }
      });
      
      // Filter to only the lessons in this task
      const taskLessons = allLessons.filter((lesson: any) => 
        task.content.lesson_ids?.includes(lesson.id)
      );
      
      setLessonsData(taskLessons);
      
      // Check completion status for each lesson
      const progressMap: Record<number, boolean> = {};
      for (const lessonId of task.content.lesson_ids || []) {
        const lesson = taskLessons.find((l: any) => l.id === lessonId);
        if (lesson) {
          progressMap[lessonId] = lesson.is_completed || false;
        }
      }
      setLessonProgress(progressMap);
      
      // Auto-complete if all lessons are completed
      const allCompleted = Object.values(progressMap).every(completed => completed);
      
      if (allCompleted && !isCompleted && task.content.lesson_ids?.length > 0) {
        onCompletion(true);
      }
      
    } catch (error) {
      console.error('Failed to fetch course data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (task.content.course_id && task.content.lesson_ids?.length > 0) {
      setLoading(true);
      fetchCourseAndLessons();
    } else {
      setLoading(false);
    }
    // Only re-fetch when course_id or lesson_ids actually change, not on every studentId/readOnly change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.content.course_id, JSON.stringify(task.content.lesson_ids)]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading course information...</div>
      </div>
    );
  }

  const completedCount = Object.values(lessonProgress).filter(c => c).length;
  const totalCount = task.content.lesson_ids?.length || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Complete the following lessons:
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-secondary p-3 rounded-md">
        <div className="flex items-center space-x-2 mb-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{courseData?.title || `Course ${task.content.course_id}`}</span>
        </div>
        <div className="space-y-2 ml-6">
          {lessonsData.length > 0 ? (
            lessonsData.map((lesson: any) => {
              const lessonCompleted = lessonProgress[lesson.id] || false;
              return (
                <div key={lesson.id} className="text-sm flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    {lessonCompleted ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                    )}
                    <span className={lessonCompleted ? 'text-green-700 dark:text-green-400 line-through' : 'text-foreground'}>
                      {lesson.title}
                    </span>
                  </div>
                  {!readOnly && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 ml-2" 
                      onClick={() => window.open(`/course/${task.content.course_id}/lesson/${lesson.id}`, '_blank')}
                    >
                      Go to Lesson <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            task.content.lesson_ids?.map((lessonId: number) => (
              <div key={lessonId} className="text-sm flex items-center justify-between">
                <span>Lesson #{lessonId}</span>
                {!readOnly && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0" 
                    onClick={() => window.open(`/course/${task.content.course_id}/lesson/${lessonId}`, '_blank')}
                  >
                    Go to Lesson <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        {totalCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-border">
            <div className="text-xs text-gray-600 dark:text-gray-400">
             Progress: {completedCount} / {totalCount} lessons completed
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all" 
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MultiTaskSubmission({ assignment, onSubmit, initialAnswers, readOnly = false, isSubmitting = false, studentId }: MultiTaskSubmissionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Handle both formats: { tasks: {...} } or direct object {...}
  const [answers, setAnswers] = useState<Record<string, any>>(
    initialAnswers?.tasks || initialAnswers || {}
  );
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (assignment.content && assignment.content.tasks) {
      setTasks(assignment.content.tasks);
    }
  }, [assignment]);

  // Update answers when initialAnswers changes
  useEffect(() => {
    if (initialAnswers) {
      const parsedAnswers = initialAnswers?.tasks || initialAnswers || {};
      console.log('MultiTaskSubmission - Updating answers from initialAnswers:', parsedAnswers);
      setAnswers(parsedAnswers);
    }
  }, [initialAnswers]);

  const handleTaskCompletion = (taskId: string, data: any) => {
    if (readOnly) return;
    
    setAnswers(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        ...data,
        completed: true // Mark as interacted/completed
      }
    }));
  };

  const handleFilesUpload = async (taskId: string, files: FileList) => {
    if (readOnly) return;
    
    try {
      setUploading(prev => ({ ...prev, [taskId]: true }));
      
      const uploadedFiles = [];
      
      for (let i = 0; i < files.length; i++) {
        let fileToUpload = files[i];

        // Check if it's an image and compress
        if (fileToUpload.type.startsWith('image/')) {
          toast(`Compressing image ${i + 1}/${files.length}...`, 'info');
          fileToUpload = await compressImage(fileToUpload);
        }

        console.log(`🚀 Uploading file: ${fileToUpload.name}, Size: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload file using existing API
        const response = await apiClient.uploadTeacherFile(fileToUpload);
        
        uploadedFiles.push({
          file_url: response.file_url || response.url,
          file_name: fileToUpload.name,
          file_size: fileToUpload.size
        });
      }
      
      // Get existing files if any
      const existingFiles = answers[taskId]?.files || [];
      // Also check for legacy single file and migrate it if needed, but we prioritized 'files' array
      let legacyFile = null;
      if (!existingFiles.length && answers[taskId]?.file_url) {
        legacyFile = {
            file_url: answers[taskId].file_url,
            file_name: answers[taskId].file_name,
            file_size: answers[taskId].file_size
        };
      }
      
      const finalFiles = [...(existingFiles.length ? existingFiles : (legacyFile ? [legacyFile] : [])), ...uploadedFiles];

      handleTaskCompletion(taskId, {
        files: finalFiles,
        // Keep legacy fields updated with the LAST uploaded file for backward compat if needed, 
        // strictly speaking we should probably null them out or just keep them as 'last uploaded'
        file_url: uploadedFiles[uploadedFiles.length - 1].file_url,
        file_name: uploadedFiles[uploadedFiles.length - 1].file_name,
        file_size: uploadedFiles[uploadedFiles.length - 1].file_size
      });
      
      toast('Files uploaded successfully', 'success');
    } catch (error) {
      console.error('File upload failed:', error);
      toast('Failed to upload files. Please try again.', 'error');
    } finally {
      setUploading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleRemoveFile = (taskId: string, fileIndex: number) => {
    if (readOnly) return;

    const currentFiles = answers[taskId]?.files || [];
    // Handle legacy single file case being viewed as list
    let filesList = currentFiles;
    if (filesList.length === 0 && answers[taskId]?.file_url) {
        filesList = [{
            file_url: answers[taskId].file_url,
            file_name: answers[taskId].file_name,
            file_size: answers[taskId].file_size
        }];
    }

    const newFiles = [...filesList];
    newFiles.splice(fileIndex, 1);

    handleTaskCompletion(taskId, {
        files: newFiles,
        // Update legacy fields to last file or null
        file_url: newFiles.length > 0 ? newFiles[newFiles.length - 1].file_url : null,
        file_name: newFiles.length > 0 ? newFiles[newFiles.length - 1].file_name : null,
        file_size: newFiles.length > 0 ? newFiles[newFiles.length - 1].file_size : null
    });
  };

  const handleSubmit = () => {
    onSubmit({ tasks: answers });
  };

  const renderTaskSubmission = (task: Task) => {
    const taskAnswer = answers[task.id] || {};
    const hasFiles = taskAnswer.files && taskAnswer.files.length > 0;
    const hasLegacyFile = taskAnswer.file_url;
    const isCompleted = taskAnswer.completed || hasFiles || hasLegacyFile || !!taskAnswer.text_response;

    switch (task.task_type) {
      case 'course_unit':
        return (
          <CourseUnitTaskDisplay 
            task={task} 
            isCompleted={!!answers[task.id]} 
            onCompletion={(completed) => handleTaskCompletion(task.id, { completed })}
            readOnly={readOnly}
            studentId={studentId}
          />
        );

      case 'file_task':
        // Prepare files list for display, merging legacy file_url if files array is empty
        const displayFiles = hasFiles ? taskAnswer.files : (hasLegacyFile ? [{
            file_url: taskAnswer.file_url,
            file_name: taskAnswer.file_name,
            file_size: taskAnswer.file_size
        }] : []);

        return (
          <div className="space-y-3">
            <div className="text-sm font-medium">{task.content.question}</div>
            
            {/* Teacher Reference File */}
            {task.content.teacher_file_url && (
              <div className="space-y-2">
                {/* Image Preview for teacher's reference file */}
                {task.content.teacher_file_name && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(task.content.teacher_file_name) && (
                  <div className="border dark:border-border rounded-lg overflow-hidden bg-gray-50 dark:bg-secondary">
                    <img 
                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + task.content.teacher_file_url}
                      alt={task.content.teacher_file_name || 'Reference image'}
                      className="w-full h-auto max-h-[600px] object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* Download Link */}
                <div className="flex items-center p-2 bg-secondary/50 dark:bg-secondary rounded-md text-sm border border-border">
                  <FileText className="w-4 h-4 text-muted-foreground mr-2" />
                  <a href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + task.content.teacher_file_url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                    Download Reference File: {task.content.teacher_file_name || 'File'}
                  </a>
                </div>
              </div>
            )}
            
            {/* Uploaded Files List */}
            {displayFiles.length > 0 && (
                <div className="space-y-3">
                    {displayFiles.map((file: any, index: number) => (
                        <div key={index} className="space-y-3">
                            {/* Image Preview */}
                            {file.file_name && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.file_name) && (
                                <div className="border dark:border-border rounded-lg overflow-hidden bg-gray-50 dark:bg-secondary">
                                <img 
                                    src={file.file_url.startsWith('http') 
                                    ? file.file_url 
                                    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + file.file_url}
                                    alt={file.file_name || 'Uploaded image'}
                                    className="w-full h-auto max-h-[600px] object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                />
                                </div>
                            )}

                             {/* File Info Card */}
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800 dark:text-green-400">{file.file_name || `File ${index + 1}`}</span>
                                {file.file_size && (
                                    <span className="text-xs text-green-600 dark:text-green-500">({(file.file_size / 1024 / 1024).toFixed(2)} MB)</span>
                                )}
                                </div>
                                <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                    const url = file.file_url.startsWith('http') 
                                        ? file.file_url 
                                        : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + file.file_url;
                                    window.open(url, '_blank');
                                    }}
                                    className="text-foreground hover:underline h-8 px-2"
                                >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Open
                                </Button>
                                {!readOnly && (
                                    <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveFile(task.id, index)}
                                    className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
                                    >
                                    <X className="w-4 h-4" />
                                    </Button>
                                )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Upload Area - Always visible if not readonly, to allow adding MORE files */}
            {!readOnly && (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    id={`file-${task.id}`}
                    multiple
                    onChange={(e) => e.target.files && e.target.files.length > 0 && handleFilesUpload(task.id, e.target.files)}
                    className="hidden"
                    accept={(() => {
                      const types = task.content.allowed_file_types || [];
                      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
                      const hasImages = types.some((t: string) => imageExts.includes(t.toLowerCase()));
                      const extensions = types.map((t: string) => `.${t}`).join(',');
                      return hasImages ? `image/*,${extensions}` : extensions;
                    })()}
                  />
                  <label htmlFor={`file-${task.id}`} className="cursor-pointer">
                    <div className="flex flex-col items-center space-y-2">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-foreground hover:underline cursor-pointer">
                        {uploading[task.id] ? 'Uploading...' : (displayFiles.length > 0 ? 'Add Another File' : 'Upload File(s)')}
                      </span>
                      <span className="text-xs text-gray-500">
                        Max {task.content.max_file_size_mb}MB per file
                      </span>
                    </div>
                  </label>
                </div>
            )}

            {/* Answer Fields for Auto-Check */}
            {task.content.answer_fields && task.content.answer_fields.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Answer Fields</Label>
                  {readOnly && taskAnswer.auto_check_result && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      taskAnswer.auto_check_result.correct_count === taskAnswer.auto_check_result.total_count 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {taskAnswer.auto_check_result.correct_count}/{taskAnswer.auto_check_result.total_count} Correct
                    </div>
                  )}
                </div>
                {task.content.answer_fields.map((field: any, fieldIndex: number) => {
                  const isCorrect = taskAnswer.auto_check_result?.details?.[field.id];
                  const showValidation = readOnly && taskAnswer.auto_check_result;
                  
                  return (
                    <div key={field.id} className="flex items-center gap-2">
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px]">{field.label || (fieldIndex + 1)}.</span>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={taskAnswer.field_answers?.[field.id] || taskAnswer.field_answers?.[String(field.id)] || ''}
                          onChange={(e) => {
                            const newFieldAnswers = { 
                              ...(taskAnswer.field_answers || {}), 
                              [field.id]: e.target.value 
                            };
                            handleTaskCompletion(task.id, { field_answers: newFieldAnswers });
                          }}
                          placeholder="Enter your answer..."
                          className={`text-sm font-mono flex-1 ${
                            showValidation 
                              ? (isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20 pr-8' : 'border-red-500 bg-red-50 dark:bg-red-900/20 pr-8')
                              : ''
                          }`}
                          disabled={readOnly}
                        />
                        {showValidation && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'text_task':
        return (
          <div className="space-y-3">
     
            <div className="text-sm font-medium">{task.content.question}</div>
            {/* Student Response Label */}
            {readOnly && taskAnswer.text_response && (
              <div className="text-xs text-gray-500 font-medium">Student's Response:</div>
            )}
            <Textarea
              value={taskAnswer.text_response || ''}
              onChange={(e) => handleTaskCompletion(task.id, { text_response: e.target.value })}
              placeholder="Type your answer here..."
              rows={4}
              disabled={readOnly}
              className={readOnly ? "bg-gray-50 dark:bg-secondary" : ""}
            />
            {!readOnly && task.content.max_length && (
              <div className="text-xs text-right text-gray-500">
                {(taskAnswer.text_response?.length || 0)} / {task.content.max_length} characters
              </div>
            )}
            {/* Keywords hint for teacher grading */}
            {task.content.keywords && task.content.keywords.length > 0 && readOnly && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <span className="font-medium">Keywords for grading:</span> {task.content.keywords.join(', ')}
              </div>
            )}

            {/* Answer Fields for Auto-Check */}
            {task.content.answer_fields && task.content.answer_fields.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Answer Fields</Label>
                  {readOnly && taskAnswer.auto_check_result && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      taskAnswer.auto_check_result.correct_count === taskAnswer.auto_check_result.total_count 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {taskAnswer.auto_check_result.correct_count}/{taskAnswer.auto_check_result.total_count} Correct
                    </div>
                  )}
                </div>
                {task.content.answer_fields.map((field: any, fieldIndex: number) => {
                  const isCorrect = taskAnswer.auto_check_result?.details?.[field.id];
                  const showValidation = readOnly && taskAnswer.auto_check_result;
                  
                  return (
                    <div key={field.id} className="flex items-center gap-2">
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px]">{field.label || (fieldIndex + 1)}.</span>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={taskAnswer.field_answers?.[field.id] || taskAnswer.field_answers?.[String(field.id)] || ''}
                          onChange={(e) => {
                            const newFieldAnswers = { 
                              ...(taskAnswer.field_answers || {}), 
                              [field.id]: e.target.value 
                            };
                            handleTaskCompletion(task.id, { field_answers: newFieldAnswers });
                          }}
                          placeholder="Enter your answer..."
                          className={`text-sm font-mono flex-1 ${
                            showValidation 
                              ? (isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20 pr-8' : 'border-red-500 bg-red-50 dark:bg-red-900/20 pr-8')
                              : ''
                          }`}
                          disabled={readOnly}
                        />
                        {showValidation && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'link_task':
        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">{task.content.link_description}</div>
            <div className="flex items-center p-3 border rounded-lg bg-secondary/50 dark:bg-secondary border-border">
              <LinkIcon className="w-4 h-4 text-muted-foreground mr-2" />
              <a href={task.content.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline flex-1 truncate">
                {task.content.url}
              </a>
              <ExternalLink className="w-3 h-3 text-gray-400 ml-2" />
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox 
                id={`task-${task.id}`} 
                checked={isCompleted}
                onCheckedChange={(checked) => handleTaskCompletion(task.id, { completed: checked })}
                disabled={readOnly}
              />
              <Label htmlFor={`task-${task.id}`}>
                I have {task.content.completion_criteria === 'watch' ? 'watched' : 
                        task.content.completion_criteria === 'read' ? 'read' : 
                        task.content.completion_criteria === 'complete' ? 'completed' : 'visited'} this resource
              </Label>
            </div>
          </div>
        );

      case 'pdf_text_task':
        return (
          <div className="space-y-3">
            {/* File Download Link */}
            {task.content.teacher_file_url && (
              <div className="flex items-center p-3 bg-secondary/50 dark:bg-secondary rounded-md border border-border">
                <FileSearch className="w-5 h-5 text-muted-foreground mr-3" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {task.content.teacher_file_name || 'Reference File'}
                  </div>
                  <a 
                    href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + task.content.teacher_file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-foreground hover:underline"
                  >
                    Open/Download File
                  </a>
                </div>
              </div>
            )}
            
            {/* Question/Instructions */}
            <div className="text-sm font-medium">{task.content.question}</div>
            
            {/* Student Response Label */}
            {readOnly && taskAnswer.text_response && (
              <div className="text-xs text-gray-500 font-medium">Student's Response:</div>
            )}
            
            {/* Text Response */}
            <Textarea
              value={taskAnswer.text_response || ''}
              onChange={(e) => handleTaskCompletion(task.id, { text_response: e.target.value })}
              placeholder="Type your answer here..."
              rows={5}
              disabled={readOnly}
              className={readOnly ? "bg-gray-50 dark:bg-secondary" : ""}
            />
            {!readOnly && task.content.max_length && (
              <div className="text-xs text-right text-gray-500">
                {(taskAnswer.text_response?.length || 0)} / {task.content.max_length} characters
              </div>
            )}
            
            {/* Keywords hint for teacher grading */}
            {task.content.keywords && task.content.keywords.length > 0 && readOnly && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <span className="font-medium">Keywords for grading:</span> {task.content.keywords.join(', ')}
              </div>
            )}

            {/* Answer Fields for Auto-Check */}
            {task.content.answer_fields && task.content.answer_fields.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Answer Fields</Label>
                  {readOnly && taskAnswer.auto_check_result && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      taskAnswer.auto_check_result.correct_count === taskAnswer.auto_check_result.total_count 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {taskAnswer.auto_check_result.correct_count}/{taskAnswer.auto_check_result.total_count} Correct
                    </div>
                  )}
                </div>
                {task.content.answer_fields.map((field: any, fieldIndex: number) => {
                  const isCorrect = taskAnswer.auto_check_result?.details?.[field.id];
                  const showValidation = readOnly && taskAnswer.auto_check_result;
                  
                  return (
                    <div key={field.id} className="flex items-center gap-2">
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px]">{field.label || (fieldIndex + 1)}.</span>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={taskAnswer.field_answers?.[field.id] || taskAnswer.field_answers?.[String(field.id)] || ''}
                          onChange={(e) => {
                            const newFieldAnswers = { 
                              ...(taskAnswer.field_answers || {}), 
                              [field.id]: e.target.value 
                            };
                            handleTaskCompletion(task.id, { field_answers: newFieldAnswers });
                          }}
                          placeholder="Enter your answer..."
                          className={`text-sm font-mono flex-1 ${
                            showValidation 
                              ? (isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20 pr-8' : 'border-red-500 bg-red-50 dark:bg-red-900/20 pr-8')
                              : ''
                          }`}
                          disabled={readOnly}
                        />
                        {showValidation && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return <div>Unknown task type</div>;
    }
  };

  // Helper to check if a specific task is truly completed based on its requirements
  const checkTaskCompletion = (task: Task) => {
    const taskAnswer = answers[task.id];
    if (!taskAnswer) return false;

    switch (task.task_type) {
      case 'file_task':
        // Must have uploaded files OR a legacy file_url
        const hasFiles = (taskAnswer.files && taskAnswer.files.length > 0) || !!taskAnswer.file_url;
        // If answer fields exist, they should ideally be filled, but strict enforcement might be annoying? 
        // For now, let's enforce file upload as the primary requirement for file_task.
        return hasFiles; 
        
      case 'text_task':
        // Must have a text response
        return !!taskAnswer.text_response && taskAnswer.text_response.trim().length > 0;
        
      case 'pdf_text_task':
        // Must have a text response
        return !!taskAnswer.text_response && taskAnswer.text_response.trim().length > 0;
        
      case 'link_task':
        // Must be marked as completed
        return !!taskAnswer.completed;
        
      case 'course_unit':
        // Must be marked as completed
        return !!taskAnswer.completed;
        
      default:
        // Fallback to generic completed flag
        return !!taskAnswer.completed;
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'course_unit': return BookOpen;
      case 'file_task': return FileText;
      case 'text_task': return MessageSquare;
      case 'link_task': return LinkIcon;
      case 'pdf_text_task': return FileSearch;
      default: return FileText;
    }
  };

  return (
    <div className="space-y-6">
      {assignment.content.instructions && (
        <Card className="bg-secondary/50 dark:bg-secondary border-border">
          <CardContent className="pt-6">
            <h4 className="font-medium text-foreground mb-2">Instructions</h4>
            <p className="text-foreground text-sm whitespace-pre-wrap">{assignment.content.instructions}</p>
          </CardContent>
        </Card>
      )}

      {/* Points Summary */}
      {tasks.some(t => t.is_optional) && (
        <div className="flex items-center gap-4 text-sm px-1">
          <span className="text-gray-600 dark:text-gray-400">
            Required: <span className="font-semibold">{tasks.filter(t => !t.is_optional).reduce((sum, t) => sum + t.points, 0)}</span> pts
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            Bonus: <span className="font-semibold">+{tasks.filter(t => t.is_optional).reduce((sum, t) => sum + t.points, 0)}</span> pts
          </span>
        </div>
      )}

      <div className="space-y-4">
        {tasks.map((task, index) => {
          const Icon = getTaskIcon(task.task_type);
          const isCompleted = checkTaskCompletion(task);
          
          return (
            <Card key={task.id} className={`${isCompleted ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10" : ""} ${task.is_optional ? "border-amber-200 dark:border-amber-800" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${isCompleted ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : task.is_optional ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-400'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-foreground">{task.title}</h4>
                        {task.is_optional && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Bonus
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Task {index + 1}</span>
                        <span>•</span>
                        <span>{task.is_optional ? `+${task.points} bonus points` : `${task.points} points`}</span>
                      </div>
                    </div>
                  </div>
                  {isCompleted && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {renderTaskSubmission(task)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!readOnly && (() => {
        // Check if all required (non-optional) tasks are completed
        const requiredTasks = tasks.filter(task => !task.is_optional);
        const optionalTasks = tasks.filter(task => task.is_optional);
        
        const completedRequiredCount = requiredTasks.filter(checkTaskCompletion).length;
        const completedOptionalCount = optionalTasks.filter(checkTaskCompletion).length;
        
        const allRequiredCompleted = completedRequiredCount === requiredTasks.length && requiredTasks.length > 0;
        const hasOnlyOptionalTasks = requiredTasks.length === 0 && optionalTasks.length > 0;
        const canSubmit = allRequiredCompleted || (hasOnlyOptionalTasks && completedOptionalCount > 0);
        
        return (
          <div className="flex flex-col items-end gap-2 pt-4">
            {!canSubmit && requiredTasks.length > 0 && (
              <p className="text-sm text-amber-600">
                Complete all required tasks to submit ({completedRequiredCount}/{requiredTasks.length} done)
                {optionalTasks.length > 0 && ` • ${completedOptionalCount}/${optionalTasks.length} bonus tasks`}
              </p>
            )}
            {canSubmit && optionalTasks.length > 0 && completedOptionalCount < optionalTasks.length && (
              <p className="text-sm text-gray-500">
                {completedOptionalCount}/{optionalTasks.length} bonus tasks completed (optional)
              </p>
            )}
            <Button 
              onClick={handleSubmit} 
              size="lg" 
              className="w-full md:w-auto" 
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
            </Button>
          </div>
        );
      })()}
    </div>
  );
}
