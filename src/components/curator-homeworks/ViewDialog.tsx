import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { StatusBadge } from './StatusBadge';
import { FileText, Download, Loader2, CheckCircle, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { AudioPlayer, isAudioUrl } from '../AudioPlayer';
import type { StudentProgress, AssignmentData, SubmissionDetails } from './types';

interface ViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProgress | null;
  assignment: AssignmentData | null;
  submissionDetails: SubmissionDetails | null;
  isLoading: boolean;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ViewDialog: React.FC<ViewDialogProps> = ({
  open,
  onOpenChange,
  student,
  assignment,
  submissionDetails,
  isLoading,
}) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const renderSubmissionContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Загрузка работы...</span>
        </div>
      );
    }

    if (!submissionDetails) {
      // If student has a score but no submission details, it might be an oral/verbal assignment
      if (student?.status === 'graded' && student?.score !== null) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Эта работа была оценена без цифрового контента.</p>
            <p className="text-sm mt-1">(Возможно, работа была устной или сдана внешне)</p>
          </div>
        );
      }
      return (
        <div className="text-center py-8 text-muted-foreground">
          Контент работы недоступен
        </div>
      );
    }

    const answers = submissionDetails.answers || {};
    const hasFile = submissionDetails.file_url;
    
    // Check if this is a multi_task assignment with task definitions
    const tasks = assignment?.content?.tasks;
    const isMultiTask = assignment?.assignment_type === 'multi_task' && tasks && tasks.length > 0;

    // Render multi-task submission with questions and answers
    const renderMultiTaskAnswers = () => {
      if (!tasks) return null;

      return (
        <div className="space-y-4">
          {tasks.map((task, idx) => {
            const taskAnswer = answers[task.id] || {};
            
            return (
              <div key={task.id} className="border rounded-lg overflow-hidden">
                {/* Task header */}
                <div className="bg-muted px-4 py-2 border-b">
                  <span className="text-sm font-medium text-muted-foreground">
                    Задание {idx + 1}: {task.task_type === 'text_task' ? 'Текстовый ответ' : 
                                      task.task_type === 'file_task' ? 'Загрузка файла' :
                                      task.task_type === 'link_task' ? 'Задание со ссылкой' :
                                      task.task_type === 'course_unit' ? 'Юнит курса' : 'Задание'}
                  </span>
                </div>
                
                <div className="p-4 space-y-3">
                  {/* Question/Description */}
                  {task.content.question && (
                    <div>
                      <label className="text-xs text-muted-foreground">Вопрос</label>
                      <p className="text-sm font-medium">{task.content.question}</p>
                    </div>
                  )}
                  
                  {task.content.link_description && (
                    <div>
                      <label className="text-xs text-muted-foreground">Описание</label>
                      <p className="text-sm">{task.content.link_description}</p>
                    </div>
                  )}

                  {/* Link for link_task */}
                  {task.task_type === 'link_task' && task.content.url && (
                    <div className="flex items-center p-2 bg-blue-50 dark:bg-blue-950 rounded border">
                      <LinkIcon className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                      <a 
                        href={task.content.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline text-sm truncate"
                      >
                        {task.content.url}
                      </a>
                      <ExternalLink className="w-3 h-3 text-gray-400 ml-2 flex-shrink-0" />
                    </div>
                  )}

                  {/* Student's Answer */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground block mb-1">Ответ студента</label>
                    
                    {/* Text response */}
                    {task.task_type === 'text_task' && (
                      taskAnswer.text_response ? (
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                          <p className="text-sm whitespace-pre-wrap">{taskAnswer.text_response}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Ответ не предоставлен</p>
                      )
                    )}

                    {/* File upload */}
                    {task.task_type === 'file_task' && (
                      taskAnswer.file_url ? (
                        <div className="space-y-2">
                          {isAudioUrl(taskAnswer.file_url || taskAnswer.file_name) && (
                            <AudioPlayer
                              src={
                                taskAnswer.file_url.startsWith('http')
                                  ? taskAnswer.file_url
                                  : `${backendUrl}${taskAnswer.file_url}`
                              }
                            />
                          )}
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                            <div className="flex items-center">
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                              <span className="text-sm font-medium">{taskAnswer.file_name || 'Загруженный файл'}</span>
                            </div>
                            <a
                              href={
                                taskAnswer.file_url.startsWith('http')
                                  ? taskAnswer.file_url
                                  : `${backendUrl}${taskAnswer.file_url}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Скачать
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Файл не загружен</p>
                      )
                    )}

                    {/* Link task or course unit completion */}
                    {(task.task_type === 'link_task' || task.task_type === 'course_unit') && (
                      taskAnswer.completed ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span className="text-sm font-medium">Завершено</span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Не завершено</p>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    // Check for simple text answer (non-multi-task)
    const hasSimpleTextAnswer = answers.text;
    
    // Check for task completion format (task_xxx: { completed: true }) without task definitions
    const hasTaskCompletions = !isMultiTask && 
      Object.keys(answers).some(key => key.startsWith('task_'));

    const resolvedFileUrl = submissionDetails.file_url
      ? submissionDetails.file_url.startsWith('http')
        ? submissionDetails.file_url
        : `${backendUrl}${submissionDetails.file_url}`
      : null;
    const isAudio = isAudioUrl(submissionDetails.file_url || submissionDetails.submitted_file_name);

    return (
      <div className="space-y-4">
        {/* Audio submission - inline player */}
        {hasFile && isAudio && resolvedFileUrl && (
          <AudioPlayer src={resolvedFileUrl} />
        )}

        {/* File attachment */}
        {hasFile && (
          <div className="flex items-center p-3 bg-muted rounded-lg border">
            <FileText className="w-5 h-5 text-blue-600 mr-3" />
            <div className="flex-1">
              <div className="font-medium">
                {submissionDetails.submitted_file_name || 'Прикрепленный файл'}
              </div>
            </div>
            <a
              href={resolvedFileUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm font-medium flex items-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Скачать
            </a>
          </div>
        )}

        {/* Multi-task answers with task definitions */}
        {isMultiTask && renderMultiTaskAnswers()}

        {/* Simple text answer */}
        {hasSimpleTextAnswer && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Ответ студента
            </label>
            <div className="bg-muted p-4 rounded-lg border whitespace-pre-wrap">
              {answers.text}
            </div>
          </div>
        )}

        {/* Task completions without task definitions (fallback) */}
        {hasTaskCompletions && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Ответы на задания
            </label>
            <div className="space-y-2">
              {Object.entries(answers)
                .filter(([key]) => key.startsWith('task_'))
                .map(([taskId, taskAnswer]: [string, any], idx) => (
                  <div key={taskId} className="bg-muted p-3 rounded-lg border">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Задание {idx + 1}
                    </div>
                    {taskAnswer.text_response && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Текстовый ответ:</span>
                        <p className="text-sm whitespace-pre-wrap">{taskAnswer.text_response}</p>
                      </div>
                    )}
                    {taskAnswer.file_url && (
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-blue-600 mr-2" />
                        <a
                          href={
                            taskAnswer.file_url.startsWith('http')
                              ? taskAnswer.file_url
                              : `${backendUrl}${taskAnswer.file_url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {taskAnswer.file_name || 'Скачать файл'}
                        </a>
                      </div>
                    )}
                    {taskAnswer.completed && !taskAnswer.text_response && !taskAnswer.file_url && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">Завершено</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* No content fallback */}
        {!hasFile && !isMultiTask && !hasSimpleTextAnswer && !hasTaskCompletions && (
          <div className="text-center py-4 text-muted-foreground">
            {student?.status === 'graded' ? (
              <>
                <p>Эта работа была оценена без цифрового контента.</p>
                <p className="text-sm mt-1">(Возможно, работа была устной или сдана внешне)</p>
              </>
            ) : (
              <p>Контент работы недоступен</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Детали работы</DialogTitle>
        </DialogHeader>
        {student && assignment && (
          <div className="space-y-6 py-4">
            {/* Student & Assignment Info */}
            <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <label className="text-sm text-muted-foreground">Студент</label>
                <p className="font-medium">{student.student_name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{student.student_email}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Задание</label>
                <p className="font-medium">{assignment.title}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Курс</label>
                <p className="font-medium">{assignment.course_title}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Сдано в</label>
                <p className="font-medium">{formatDate(student.submitted_at)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Статус</label>
                <div className="mt-1">
                  <StatusBadge
                    status={student.status}
                    score={student.score}
                    maxScore={assignment.max_score}
                  />
                </div>
              </div>
            </div>

            {/* Submission Content */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Работа студента
              </h3>
              {renderSubmissionContent()}
            </div>

            {/* Feedback */}
            {student.feedback && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Отзыв преподавателя
                </label>
                <p className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  {student.feedback}
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
