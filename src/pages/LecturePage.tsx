import React, { useEffect, useState } from 'react';
import { sanitizeHtml } from '../lib/safeHtml';
import { useParams } from 'react-router-dom';
import apiClient from '../services/api';
import type { Lesson, Step } from '../types';
import Tabs from '../components/Tabs';
import Loader from '../components/Loader';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';

export default function LecturePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const t = useT();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user] = useState(() => apiClient.getCurrentUserSync());

  useEffect(() => {
    if (!lessonId) return;

    const loadLessonData = async () => {
      try {
        setLoading(true);
        const [lessonData, stepsData, assignmentsData] = await Promise.all([
          apiClient.getLesson(lessonId),
          apiClient.getLessonSteps(lessonId),
          apiClient.getAssignments({ lesson_id: lessonId })
        ]);

        setLesson(lessonData);
        setSteps(stepsData);
        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Failed to load lesson data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLessonData();
  }, [lessonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-foreground">{t('lessonPlayer.lecture.notFound')}</h2>
        <p className="text-muted-foreground mt-2">{t('lessonPlayer.lecture.notFoundHint')}</p>
      </div>
    );
  }

  // Get the first step to determine content type and content
  const firstStep = steps.length > 0 ? steps[0] : null;
  const contentType = firstStep?.content_type || 'text';
  const videoUrl = firstStep?.video_url;
  const contentText = firstStep?.content_text;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-muted-foreground mt-1">{lesson.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Tabs tabs={[t('lessonPlayer.lecture.tabContent'), t('lessonPlayer.lecture.tabAssignments')]} value={tab} onChange={setTab} />
      </div>

      {tab === 0 && (
        <div className="space-y-4">
          {contentType === 'video_text' && videoUrl ? (
            <div className="bg-black rounded-2xl overflow-hidden aspect-video">
              {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                <iframe
                  src={videoUrl.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allowFullScreen
                  title={lesson.title}
                />
              ) : (
                <video controls src={videoUrl} className="w-full h-full" />
              )}
            </div>
          ) : (
            <div className="card p-6">
              <div className="prose dark:prose-invert max-w-none">
                {contentText ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentText) }} />
                ) : (
                  <p className="text-muted-foreground">{t('lessonPlayer.lecture.noContent')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="card p-5">
          <div className="font-semibold mb-3">{t('lessonPlayer.lecture.tabAssignments')}</div>
          {assignments.length === 0 ? (
            <div className="text-muted-foreground text-sm">{t('lessonPlayer.lecture.noAssignments')}</div>
          ) : (
            <ul className="space-y-3">
              {assignments.map(assignment => (
                <li key={assignment.id} className="flex items-center justify-between p-4 bg-muted rounded">
                  <div>
                    <div className="font-medium">{assignment.title}</div>
                    <div className="text-sm text-muted-foreground">{assignment.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('lessonPlayer.lecture.meta', { type: assignment.assignment_type, score: assignment.max_score })}
                      {assignment.time_limit_minutes && (
                        <span> {t('lessonPlayer.lecture.timeLimit', { minutes: assignment.time_limit_minutes })}</span>
                      )}
                    </div>
                  </div>
                  <a 
                    href={`/assignment/${assignment.id}`} 
                    className="btn-primary text-sm"
                  >
                    {user?.role === 'student' ? t('lessonPlayer.lecture.start') : t('lessonPlayer.lecture.view')}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


