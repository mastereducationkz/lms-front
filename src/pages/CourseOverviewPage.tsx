import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChevronRight, Play, FileText, HelpCircle, Clock, Users, CheckCircle, Lock, ClipboardCheck } from 'lucide-react';
import apiClient from '../services/api';
import type { Course, Lesson } from '../types';
import { formatDeadline, formatDuration as formatTimeLeft, getMyCheckpoints, type StudentCheckpointItem } from '../services/api/checkpoints';
import { buildCheckpointHints, firstOpenCheckpoint, type CheckpointHints } from '../lib/checkpointHints';
import { unitStepProgress } from '../lib/unitProgress';

import { Progress } from '../components/ui/progress';
import { CompletionMeta } from '../components/progress/CompletionMeta';
import type { CourseCompletion } from '../types';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';

// Short chip labels/colors for a checkpoint quiz row — mirrors LessonPage's sidebar chips.
const CHECKPOINT_CHIP_LABEL: Record<StudentCheckpointItem['status'], MessageKey> = {
  locked: 'lessonPlayer.chip.locked', available: 'lessonPlayer.chip.open', completed: 'lessonPlayer.chip.done',
  overdue: 'lessonPlayer.chip.overdue', reopened: 'lessonPlayer.chip.open',
};
const CHECKPOINT_CHIP_CLASS: Record<StudentCheckpointItem['status'], string> = {
  locked: 'bg-muted text-muted-foreground',
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  completed: 'bg-brand-subtle text-brand-subtle-foreground',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  reopened: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export default function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const t = useT();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkpointItems, setCheckpointItems] = useState<StudentCheckpointItem[]>([]);
  const checkpointHints: CheckpointHints = useMemo(() => buildCheckpointHints(checkpointItems), [checkpointItems]);
  // An open checkpoint to invite the student to (lowest number first). Checkpoints are optional:
  // this is an invitation, never a pause — nothing in the course waits for it.
  const openCheckpoint = useMemo(() => firstOpenCheckpoint(checkpointItems), [checkpointItems]);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return t('lessonPlayer.common.minutesLong', { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return t('lessonPlayer.common.hours', { count: hours });
    }
    return `${t('lessonPlayer.common.hours', { count: hours })} ${t('lessonPlayer.common.minutesLong', { count: remainingMinutes })}`;
  };

  // The course number comes from the backend — the same value every other screen shows
  // (required steps of unit lessons; checkpoints and optional steps never count).
  const [completion, setCompletion] = useState<CourseCompletion | null>(null);
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    apiClient.getCourseCompletion(courseId)
      .then((data) => { if (!cancelled) setCompletion(data); })
      .catch(() => { if (!cancelled) setCompletion(null); });
    return () => { cancelled = true; };
  }, [courseId]);
  const courseProgress = completion?.completion_percentage ?? 0;

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setIsLoading(true);

      // Load course details
      const courseData = await apiClient.getCourse(courseId!);
      setCourse(courseData);

      // Load modules with lessons
      const modulesData = await apiClient.getCourseModules(courseId!, true);
      setModules(modulesData);

    } catch (error) {
      console.error('Failed to load course data:', error);
      setError(t('lessonPlayer.lesson.courseLoadFailed'));
    } finally {
      setIsLoading(false);
    }

    // SAT Checkpoints: which units feed which checkpoint, for the checkpoint chips below.
    // Returns { enabled: false, items: [] } for students outside a checkpoints-enabled
    // group, so this fails silently and simply renders no chips.
    try {
      const res = await getMyCheckpoints();
      setCheckpointItems(res?.items || []);
    } catch {
      setCheckpointItems([]);
    }
  };

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.kind === 'checkpoint') {
      return <ClipboardCheck className="w-4 h-4" />;
    }
    // Check if lesson has steps and get the first step's content type
    if (lesson.steps && lesson.steps.length > 0) {
      const firstStep = lesson.steps[0];
      switch (firstStep.content_type) {
        case 'video_text':
          return <Play className="w-4 h-4" />;
        case 'quiz':
          return <HelpCircle className="w-4 h-4" />;
        case 'text':
        default:
          return <FileText className="w-4 h-4" />;
      }
    }
    return <FileText className="w-4 h-4" />;
  };

  const handleLessonClick = (lesson: any) => {
    // Check if lesson is accessible (for sequential progression)
    const isAccessible = (lesson as any).is_accessible !== false;
    
    if (!isAccessible) {
      alert(t('lessonPlayer.overview.lockedAlert'));
      return;
    }
    
    navigate(`/course/${courseId}/lesson/${lesson.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('lessonPlayer.error.title')}</h2>
          <p className="text-muted-foreground">{error || t('lessonPlayer.overview.notFound')}</p>
          <Button onClick={() => navigate('/courses')} className="mt-4">
            {t('lessonPlayer.overview.backToCourses')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Course Info (not a header) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between gap-4">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
            <p className="mt-1 text-base text-muted-foreground">{course.description}</p>

            {/* Progress Bar */}
            <div className="mt-6 max-w-xl">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span className="font-medium">{t('lessonPlayer.overview.progress')}</span>
                <span className="font-medium">{courseProgress}%</span>
              </div>
              <Progress value={courseProgress} className="h-2" />
              <CompletionMeta
                className="mt-2"
                lessonsDone={completion?.lessons_done}
                lessonsTotal={completion?.lessons_total}
                checkpoints={completion?.checkpoints}
              />
            </div>

            <div className="mt-6 flex items-center space-x-4">
              {course.estimated_duration_minutes && course.estimated_duration_minutes > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(course.estimated_duration_minutes)}
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('lessonPlayer.common.modules', { count: modules.length })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {openCheckpoint && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30" role="status">
              <p className="font-semibold text-foreground">
                {t('lessonPlayer.overview.checkpointOpen', { number: openCheckpoint.number })}
              </p>
              <p className="mt-0.5 text-sm text-foreground/80">
                {openCheckpoint.status === 'overdue'
                  ? t('lessonPlayer.overview.checkpointLate', { questions: t('lessonPlayer.common.questions', { count: openCheckpoint.total_questions }) })
                  : t('lessonPlayer.overview.checkpointDue', {
                      questions: t('lessonPlayer.common.questions', { count: openCheckpoint.total_questions }),
                      deadline: formatDeadline(openCheckpoint.deadline),
                      left: openCheckpoint.deadline ? formatTimeLeft((new Date(openCheckpoint.deadline).getTime() - Date.now()) / 60000) : '',
                    })}
              </p>
              {openCheckpoint.quiz && (
                <Button
                  className="mt-2"
                  onClick={() => navigate(`/course/${openCheckpoint.quiz!.course_id}/lesson/${openCheckpoint.quiz!.lesson_id}`)}
                >
                  {t('lessonPlayer.overview.takeCheckpoint', { number: openCheckpoint.number })}
                </Button>
              )}
            </div>
          )}
          {modules.map((module) => (
            <Card key={module.id} className={module.is_completed ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/20" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">{module.title}</h2>
                      {module.is_completed && (
                        <span className="flex items-center text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t('lessonPlayer.overview.moduleCompleted')}
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
                    {t('common.lessons', { count: module.total_lessons })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {module.lessons && module.lessons.length > 0 ? (
                  <div className="space-y-3">
                    {module.lessons.map((lesson: any) => {
                      const isAccessible = (lesson as any).is_accessible !== false;
                      const isCheckpointLesson = lesson.kind === 'checkpoint';
                      const checkpointItem = checkpointHints.byQuizLesson.get(Number(lesson.id));
                      const progress = unitStepProgress(lesson);

                      return (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        disabled={!isAccessible}
                        data-tip={isCheckpointLesson ? 'checkpoint-row' : undefined}
                        title={!isAccessible
                          ? (isCheckpointLesson && checkpointItem
                              ? (checkpointItem.locked_reason || t('lessonPlayer.checkpoint.notOpenTooltip'))
                              : t('lessonPlayer.lessonLockedTooltip'))
                          : progress.title}
                        className={`relative overflow-hidden w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                          !isAccessible
                            ? 'opacity-50 cursor-not-allowed bg-muted border-border'
                            : lesson.is_completed
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'border-border hover:border-gray-300 dark:hover:border-border hover:bg-muted'
                        }`}
                      >
                        {isAccessible && progress.showFill && (
                          <span
                            className="absolute inset-y-0 left-0 bg-foreground/[0.06] transition-[width] duration-300 motion-reduce:transition-none"
                            style={{ width: `${progress.ratio * 100}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex items-center space-x-3">
                          <div className={`flex-shrink-0 ${
                            !isAccessible 
                              ? 'text-gray-400 dark:text-muted-foreground' 
                              : lesson.is_completed 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-gray-400 dark:text-muted-foreground'
                          }`}>
                            {!isAccessible ? (
                              <Lock className="w-5 h-5" />
                            ) : lesson.is_completed ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              getLessonIcon(lesson)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium ${lesson.is_completed ? 'text-green-900 dark:text-green-100' : 'text-foreground'}`}>
                                {lesson.title}
                              </h3>
                              {isCheckpointLesson && checkpointItem ? (
                                <span className={`h-5 px-2 inline-flex items-center rounded text-[10px] font-medium shrink-0 ${CHECKPOINT_CHIP_CLASS[checkpointItem.status]}`}>
                                  {t(CHECKPOINT_CHIP_LABEL[checkpointItem.status])}
                                </span>
                              ) : null}
                            </div>
                            {lesson.description && (
                              <p className={`text-sm mt-1 ${lesson.is_completed ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                                {lesson.description}
                              </p>
                            )}
                            {lesson.steps && lesson.steps.length > 0 && (
                              <p className={`text-xs mt-1 ${lesson.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-muted-foreground'}`}>
                                {t('lessonPlayer.common.steps', { count: lesson.steps.length })}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`relative w-4 h-4 ${lesson.is_completed ? 'text-green-400' : 'text-gray-400 dark:text-muted-foreground'}`} />
                      </button>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t('lessonPlayer.overview.noLessons')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}


