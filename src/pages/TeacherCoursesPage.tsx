import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import EmptyState from '../components/EmptyState';
import { BookOpen, Plus, Users, Settings, AlertCircle, Eye, Pencil } from 'lucide-react';
import CreateCourseModal from '../components/CreateCourseModal.tsx';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { canEditCourseContent } from '../lib/courseAccess';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/courseAuthoring';

interface CourseWithStats {
  id: number;
  title: string;
  description?: string;
  teacher_id: number;
  teacher_name?: string;
  created_at: string;
  cover_image_url?: string;
  modules_count?: number;
  students_count?: number;
  completed_count?: number;
  avg_progress?: number;
  last_activity?: string;
  status?: 'active' | 'draft' | 'archived';
}

export default function TeacherCoursesPage() {
  const { user } = useAuth();
  const t = useT();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError('');

      // Course management (admins and head teachers since 2026-10-03): every course, drafts included.
      const coursesData = await apiClient.getCourses({ limit: 1000 });
      const teacherCourses = canEditCourseContent(user?.role)
        ? coursesData
        : coursesData.filter((course: any) => course.teacher_id === user?.id);

      // Enhance with additional stats if available
      const coursesWithStats = await Promise.all(
        teacherCourses.map(async (course: any) => {
          try {
            // Try to get modules count
            const modules = await apiClient.getCourseModules(course.id);
            const modulesCount = modules?.length || 0;

            // Try to get course progress aggregate
            let studentsCount = 0;
            let completedCount = 0;
            let avgProgress = 0;
            let lastActivity: string | undefined = undefined;
            try {
              const progressResp: any = await apiClient.getCourseProgress(String(course.id));
              const records: any[] = Array.isArray(progressResp)
                ? progressResp
                : (progressResp?.records || progressResp?.data || progressResp?.students || []);
              studentsCount = records.length;
              if (studentsCount > 0) {
                let total = 0;
                let latest = 0;
                for (const r of records) {
                  const pct = Number(r.completion_percentage ?? r.progress ?? r.overall_progress ?? 0);
                  total += isNaN(pct) ? 0 : pct;
                  if (pct >= 100) completedCount += 1;
                  const ts = new Date(r.last_accessed || r.updated_at || r.completed_at || r.created_at || Date.now()).getTime();
                  if (ts > latest) latest = ts;
                }
                avgProgress = Math.round(total / studentsCount);
                if (latest) lastActivity = new Date(latest).toISOString();
              }
            } catch (err) {
              // Fallbacks if progress API not available
              studentsCount = 0;
              completedCount = 0;
              avgProgress = 0;
            }

            return {
              ...course,
              modules_count: modulesCount,
              students_count: studentsCount,
              completed_count: completedCount,
              avg_progress: avgProgress,
              last_activity: lastActivity,
              status: ((course as any).status || ((course as any).is_active ? 'active' : 'draft')) as 'active' | 'draft' | 'archived'
            };
          } catch (err) {
            console.warn('Could not load additional stats for course', course.id);
            return {
              ...course,
              modules_count: 0,
              students_count: 0,
              completed_count: 0,
              avg_progress: 0,
              status: ((course as any).status || ((course as any).is_active ? 'active' : 'draft')) as 'active' | 'draft' | 'archived'
            };
          }
        })
      );

      setCourses(coursesWithStats);
    } catch (err) {
      setError(t('courseAuthoring.courses.loadFailed'));
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 bg-border rounded w-48"></div>
            <div className="h-10 bg-border rounded w-32"></div>
          </div>
          <div className="bg-card dark:bg-card rounded-2xl shadow-card p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-border rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">{t('courseAuthoring.courses.title')}</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="font-semibold text-red-800 dark:text-red-400">{t('courseAuthoring.courses.error')}</h3>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button 
            onClick={loadCourses}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-brand" />
          {t('courseAuthoring.courses.title')}
        </h1>
        {canEditCourseContent(user?.role) && (
          <div className="flex gap-3">
            <Button 
              onClick={() => setCreateOpen(true)}
              variant="outline"
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('courseAuthoring.courses.new')}
            </Button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card dark:bg-card rounded-lg p-4 shadow-sm border border-border">
          <div className="flex items-center">
            <BookOpen className="w-6 h-6 text-brand mr-2" />
            <div>
              <div className="text-sm text-muted-foreground">{t('courseAuthoring.courses.totalCourses')}</div>
              <div className="text-xl font-bold">{courses.length}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card dark:bg-card rounded-lg p-4 shadow-sm border border-border">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
            <div>
              <div className="text-sm text-muted-foreground">{t('courseAuthoring.courses.totalStudents')}</div>
              <div className="text-xl font-bold">
                {courses.reduce((sum, course) => sum + (course.students_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card dark:bg-card rounded-lg p-4 shadow-sm border border-border">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-purple-600 mr-2 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">{t('courseAuthoring.courses.totalModules')}</div>
              <div className="text-xl font-bold">
                {courses.reduce((sum, course) => sum + (course.modules_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState 
          title={t('courseAuthoring.courses.empty')}
          subtitle={t('courseAuthoring.courses.emptyHint')}
        />
      ) : (
        <Card className="rounded-2xl-top shadow-card overflow-hidden">
          <CardHeader className="p-6">
            <CardTitle className="text-lg">{t('courseAuthoring.courses.manageTitle')}</CardTitle>
            <CardDescription>{t('courseAuthoring.courses.manageHint')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colCourse')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colModules')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colStudents')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colCompleted')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colAvgProgress')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colStatus')}</TableHead>
                  <TableHead className="px-3 @4xl:px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('courseAuthoring.courses.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map(course => (
                  <TableRow key={course.id} className="hover:bg-muted">
                    <TableCell className="px-3 @4xl:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex items-center justify-center text-muted-foreground text-xs">
                          {course.cover_image_url ? (
                            <img src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-medium">{course.title?.slice(0,1)?.toUpperCase() || 'C'}</span>
                          )}
                        </div>
                        <div className="font-medium text-foreground">{course.title}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 text-muted-foreground whitespace-nowrap">
                      <span className="font-medium">{course.modules_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 text-muted-foreground whitespace-nowrap">
                      <span className="font-medium">{course.students_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 text-muted-foreground whitespace-nowrap">
                      <span className="font-medium">{course.completed_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 text-muted-foreground whitespace-nowrap">
                      <span className="font-medium">{course.avg_progress ?? 0}%</span>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        course.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : course.status === 'draft'
                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                          : 'bg-muted text-foreground'
                      }`}>
                        {course.status === 'draft' ? t('courseAuthoring.status.draft') : course.status === 'archived' ? t('courseAuthoring.status.archived') : t('courseAuthoring.status.active')}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 @4xl:px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex space-x-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          title={t('courseAuthoring.courses.view')}
                          aria-label={t('courseAuthoring.courses.view')}
                        >
                          <Link to={`/course/${course.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        {canEditCourseContent(user?.role) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title={t('courseAuthoring.courses.edit')}
                            aria-label={t('courseAuthoring.courses.edit')}
                          >
                            <Link to={`/teacher/course/${course.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadCourses()}
      />
    </div>
  );
}


