import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Button } from '../components/ui/button';
import type { CheckpointSummary } from '../lib/completion';
import CourseCard from '../components/courses/CourseCard';
import Skeleton from '../components/Skeleton.tsx';
import apiClient from "../services/api";
import type { Course } from '../types';
import { CheckCircle, Play, Eye, Search, Users } from 'lucide-react';
import { Input } from '../components/ui/input';
import { mediaUrl } from '../lib/mediaUrl';
import {
  canEditCourseContent, filterCatalog, isReadOnlyCourseViewer, sortStaffCatalog,
} from '../lib/courseAccess';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/learning';

interface CourseItem {
  id: string;
  title: string;
  teacher: string;
  image?: string;
  progress?: number;
  status?: string;
  modules: number;
  description: string;
  duration?: number;
  in_my_groups?: boolean | null;
  isDraft?: boolean;
  lessonsDone?: number | null;
  lessonsTotal?: number | null;
  checkpoints?: CheckpointSummary | null;
  nextLesson?: { id: number; title: string } | null;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const readOnly = isReadOnlyCourseViewer(user?.role);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let coursesData: CourseItem[];
      if (user?.role === 'student') {
        // For students, get their progress overview with detailed course data
        const progressOverview = await apiClient.getStudentProgressOverview();
        // Transform the data to match Card component expectations
        coursesData = progressOverview.courses.map((course: any) => ({
          id: course.course_id.toString(),
          title: course.course_title,
          teacher: course.teacher_name,
          image: mediaUrl(course.cover_image_url) ?? undefined,
          progress: course.completion_percentage,
          status: course.completion_percentage === 100 ? 'completed' : course.completion_percentage > 0 ? 'in_progress' : 'not_started',
          modules: course.total_lessons, // Using lessons as modules for display
          description: course.teacher_name && course.teacher_name !== 'Unknown' ? t('learning.courses.teacher', { name: course.teacher_name }) : '',
          // "12 of 30 lessons" (+ the checkpoint line) — the counts behind the one course number
          lessonsDone: course.lessons_done ?? course.completed_lessons,
          lessonsTotal: course.lessons_total ?? course.total_lessons,
          checkpoints: course.checkpoints,
          nextLesson: course.next_lesson ?? null,
        }));
      } else {
        // Staff catalog (2026-10-03): every course the role may open — all published ones for
        // teachers/curators/head curators, drafts too for head teachers and admins.
        const allCourses = await apiClient.getCourses({ limit: 1000 });
        coursesData = sortStaffCatalog(allCourses.map((course: Course) => ({
          id: String(course.id),
          title: course.title,
          teacher: course.teacher_name || course.teacher?.name || 'Unknown',
          image: mediaUrl(course.cover_image_url || course.image) ?? undefined,
          description: course.description,
          modules: course.total_modules ?? 0,
          in_my_groups: course.in_my_groups,
          isDraft: course.status === 'draft',
        })));
      }
      
      setCourses(coursesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('learning.courses.loadFailed');
      setError(errorMessage);
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6">
              <Skeleton className="h-40 mb-4" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-9 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold">{t('learning.courses.title')}</h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-400">{t('learning.courses.errorTitle')}</h3>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button 
            onClick={loadCourses}
            variant="destructive"
            className="mt-2"
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const visible = user?.role === 'student' ? courses : filterCatalog(courses, search);

  return (
    <div className="space-y-6">
      <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold">{t('learning.courses.title')}</h2>
        {canEditCourseContent(user?.role) && (
          <Button 
            onClick={() => navigate('/admin/courses')}
            className="px-4 py-2 w-full @lg:w-auto"
          >
            {t('learning.courses.manage')}
          </Button>
        )}
      </div>

      {readOnly && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-subtle-foreground">
          <Eye className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {t('learning.courses.readOnlyNote')}
          </span>
        </div>
      )}

      {user?.role !== 'student' && courses.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('learning.courses.search')}
            className="pl-9"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('learning.courses.empty')}</p>
          {user?.role === 'student' && (
            <p className="text-sm mt-2">{t('learning.courses.emptyStudentHint')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4 sm:gap-6">
          {visible.map(course => (
            <CourseCard
              key={course.id}
              title={course.title}
              coverUrl={course.image}
              progress={user?.role === 'student' ? course.progress ?? 0 : undefined}
              lessonsDone={course.lessonsDone}
              lessonsTotal={course.lessonsTotal}
              checkpoints={course.checkpoints}
              nextLesson={course.nextLesson}
              description={course.description}
              badges={(course.in_my_groups || course.isDraft) ? (
                <>
                  {course.in_my_groups && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Users className="w-3 h-3" />
                      {t('learning.courses.yourGroups')}
                    </span>
                  )}
                  {course.isDraft && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {t('learning.courses.draft')}
                    </span>
                  )}
                </>
              ) : undefined}
              actionLabel={user?.role === 'student'
                ? t(course.progress === 100 ? 'learning.courses.completed' : 'learning.courses.continue')
                : t('learning.courses.view')}
              actionIcon={user?.role === 'student'
                ? (course.progress === 100 ? <CheckCircle className="w-4 h-4 mr-2" /> : undefined)
                : <Play className="w-4 h-4 mr-2" />}
              actionArrow={user?.role === 'student' && course.progress !== 100}
              actionVariant={user?.role === 'student' && course.progress === 100 ? 'outline' : 'default'}
              onOpen={() => navigate(`/course/${course.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
