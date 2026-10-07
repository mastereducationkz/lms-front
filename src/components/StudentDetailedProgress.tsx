import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  Play, 
  FileText, 
  HelpCircle, 
  TrendingUp,
  BarChart3,
  Activity
} from 'lucide-react';
import { getStudentDetailedProgress, getStudentLearningPath } from '../services/api';
import { formatDate, formatDateTime as formatLocalDateTime, type MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

/** Step content types as the API names them → their label. */
const STEP_TYPE_LABELS: Record<string, MessageKey> = {
  text: 'teacherDesk.progress.type.text',
  video_text: 'teacherDesk.progress.type.videoText',
  quiz: 'teacherDesk.progress.type.quiz',
  flashcard: 'teacherDesk.progress.type.flashcard',
  summary: 'teacherDesk.progress.type.summary',
};

/** Step statuses other than «completed» (which reads «Done» in the table). */
const STEP_STATUS_LABELS: Record<string, MessageKey> = {
  in_progress: 'teacherDesk.progress.stepInProgress',
  not_started: 'teacherDesk.progress.stepNotStarted',
};

interface StudentDetailedProgressProps {
  studentId: number;
  courseId?: number;
  onClose?: () => void;
}

interface StepProgress {
  step_id: number;
  step_title: string;
  step_order: number;
  content_type: string;
  progress: {
    status: string;
    visited_at: string | null;
    completed_at: string | null;
    time_spent_minutes: number;
    attempts: number;
  };
}

interface LearningPathStep {
  sequence_number: number;
  step_info: {
    id: number;
    title: string;
    content_type: string;
    order_index: number;
  };
  lesson_info: {
    id: number;
    title: string;
    order_index: number;
  };
  module_info: {
    id: number;
    title: string;
    order_index: number;
  };
  progress_info: {
    visited_at: string | null;
    completed_at: string | null;
    time_spent_minutes: number;
    status: string;
    time_since_previous_step_minutes: number | null;
  };
}

export default function StudentDetailedProgress({ 
  studentId, 
  courseId, 
  onClose 
}: StudentDetailedProgressProps) {
  const t = useT();
  const [detailedProgress, setDetailedProgress] = useState<any>(null);
  const [learningPath, setLearningPath] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, [studentId, courseId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load detailed progress
      const progressData = await getStudentDetailedProgress(studentId.toString(), courseId?.toString());
      setDetailedProgress(progressData);
      
      // Load learning path if courseId exists
      if (courseId) {
        const pathData = await getStudentLearningPath(studentId.toString(), courseId.toString());
        setLearningPath(pathData);
      }
      
    } catch (error) {
      console.error('Failed to load detailed progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStepIcon = (contentType: string) => {
    switch (contentType) {
      case 'video_text': return <Play className="w-4 h-4" />;
      case 'quiz': return <HelpCircle className="w-4 h-4" />;
      case 'text': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default">{t('teacherDesk.progress.statusCompleted')}</Badge>;
      case 'in_progress': return <Badge variant="secondary">{t('teacherDesk.progress.statusInProgress')}</Badge>;
      case 'not_started': return <Badge variant="outline">{t('teacherDesk.progress.statusNotStarted')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return t('teacherDesk.progress.notSpecified');
    return formatLocalDateTime(dateString, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return t('common.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t('teacherDesk.duration.hoursMinutes', { hours, minutes: mins });
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('teacherDesk.progress.loading')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!detailedProgress) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <p>{t('teacherDesk.progress.notFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t('teacherDesk.progress.title')}
              </CardTitle>
              <div className="mt-2 space-y-1">
                <p className="text-lg font-medium">{detailedProgress.student_info.name}</p>
                <p className="text-sm text-muted-foreground">{detailedProgress.student_info.email}</p>
              </div>
            </div>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t('teacherDesk.progress.completedSteps')}</p>
                <p className="text-2xl font-bold">
                  {detailedProgress.summary.completed_steps}/{detailedProgress.summary.total_steps}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t('teacherDesk.col.progress')}</p>
                <p className="text-2xl font-bold">{Math.round(detailedProgress.summary.completion_percentage)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t('teacherDesk.progress.studyTime')}</p>
                <p className="text-2xl font-bold">{formatDuration(detailedProgress.summary.total_study_time_minutes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t('teacherDesk.progress.studyPeriod')}</p>
                <p className="text-2xl font-bold">{t('common.days', { count: detailedProgress.summary.study_period_days })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">{t('teacherDesk.progress.courseOverview')}</TabsTrigger>
          <TabsTrigger value="timeline" disabled={!learningPath}>{t('teacherDesk.progress.timeline')}</TabsTrigger>
          <TabsTrigger value="activity">{t('teacherDesk.progress.activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {Object.entries(detailedProgress.courses_progress).map(([courseId, courseData]: [string, any]) => (
            <Card key={courseId}>
              <CardHeader>
                <CardTitle>{courseData.course_info.title}</CardTitle>
                {courseData.course_info.description && (
                  <p className="text-sm text-muted-foreground">{courseData.course_info.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {Object.entries(courseData.modules).map(([moduleId, moduleData]: [string, any]) => (
                  <div key={moduleId} className="mb-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">
                        {moduleData.module_info.order_index || t('teacherDesk.progress.moduleShort')}
                      </span>
                      {moduleData.module_info.title}
                    </h4>
                    
                    {Object.entries(moduleData.lessons).map(([lessonId, lessonData]: [string, any]) => (
                      <div key={lessonId} className="ml-8 mb-4">
                        <h5 className="font-medium mb-2 flex items-center gap-2">
                          <span className="bg-secondary text-secondary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            {lessonData.lesson_info.order_index || t('teacherDesk.progress.lessonShort')}
                          </span>
                          {lessonData.lesson_info.title}
                        </h5>
                        
                        <div className="ml-6">
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr className="text-left border-b">
                                  <th className="p-2 font-medium w-12">#</th>
                                  <th className="p-2 font-medium">{t('teacherDesk.progress.step')}</th>
                                  <th className="p-2 font-medium">{t('teacherDesk.col.type')}</th>
                                  <th className="p-2 font-medium">{t('teacherDesk.col.time')}</th>
                                  <th className="p-2 font-medium">{t('teacherDesk.col.status')}</th>
                                  <th className="p-2 font-medium text-right">{t('teacherDesk.progress.date')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lessonData.steps
                                  .sort((a: StepProgress, b: StepProgress) => a.step_order - b.step_order)
                                  .map((step: StepProgress) => (
                                  <tr key={step.step_id} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="p-2 text-muted-foreground">{step.step_order}</td>
                                    <td className="p-2 font-medium">{step.step_title}</td>
                                    <td className="p-2 flex items-center gap-2">
                                      {getStepIcon(step.content_type)}
                                      <span className="capitalize">{STEP_TYPE_LABELS[step.content_type] ? t(STEP_TYPE_LABELS[step.content_type]) : step.content_type.replace('_', ' ')}</span>
                                    </td>
                                    <td className="p-2">{t('teacherDesk.duration.minutesShort', { minutes: step.progress.time_spent_minutes })}</td>
                                    <td className="p-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        step.progress.status === 'completed' 
                                          ? 'bg-green-100 text-green-800' 
                                          : step.progress.status === 'in_progress'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {step.progress.status === 'completed' ? t('teacherDesk.progress.stepDone') : STEP_STATUS_LABELS[step.progress.status] ? t(STEP_STATUS_LABELS[step.progress.status]) : step.progress.status.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right text-muted-foreground text-xs">
                                      {step.progress.status === 'completed' 
                                        ? formatDateTime(step.progress.completed_at)
                                        : step.progress.started_at 
                                          ? formatDateTime(step.progress.started_at)
                                          : '-'
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          {learningPath && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('teacherDesk.progress.learningTimeline')}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('teacherDesk.progress.timelineHint')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left border-b">
                        <th className="p-2 font-medium w-12">#</th>
                        <th className="p-2 font-medium">{t('teacherDesk.progress.step')}</th>
                        <th className="p-2 font-medium">{t('teacherDesk.progress.location')}</th>
                        <th className="p-2 font-medium">{t('teacherDesk.col.time')}</th>
                        <th className="p-2 font-medium">{t('teacherDesk.col.status')}</th>
                        <th className="p-2 font-medium text-right">{t('teacherDesk.progress.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learningPath.learning_path.map((step: LearningPathStep) => (
                        <tr key={step.sequence_number} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">{step.sequence_number}</td>
                          <td className="p-2 font-medium">{step.step_info.title}</td>
                          <td className="p-2 text-muted-foreground">
                            {step.module_info.title} → {step.lesson_info.title}
                          </td>
                          <td className="p-2">
                            {t('teacherDesk.duration.minutesShort', { minutes: step.progress_info.time_spent_minutes })}
                            {step.progress_info.time_since_previous_step_minutes && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {t('teacherDesk.progress.break', { duration: formatDuration(step.progress_info.time_since_previous_step_minutes) })}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {getStatusBadge(step.progress_info.status)}
                          </td>
                          <td className="p-2 text-right text-muted-foreground text-xs">
                            {step.progress_info.status === 'completed' 
                              ? formatDateTime(step.progress_info.completed_at)
                              : formatDateTime(step.progress_info.started_at || step.progress_info.visited_at)
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('teacherDesk.progress.dailyActivity')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('teacherDesk.progress.last30Days')}</p>
            </CardHeader>
            <CardContent>
              {detailedProgress.daily_activity.length > 0 ? (
                <div className="space-y-3">
                  {detailedProgress.daily_activity.map((day: any) => (
                    <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(day.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('teacherDesk.progress.stepsCompleted', { count: day.steps_completed })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatDuration(day.time_spent_minutes)}</p>
                        <Progress 
                          value={(day.steps_completed / 10) * 100} 
                          className="w-20 h-2 mt-1" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t('teacherDesk.progress.noActivity')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
