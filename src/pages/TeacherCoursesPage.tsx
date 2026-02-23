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

      // Get courses for this teacher
      const coursesData = await apiClient.getCourses();
      
      // Filter courses for current teacher if needed
      const teacherCourses = user?.role === 'admin' 
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
      setError('Failed to load courses');
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
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="bg-white dark:bg-card rounded-2xl shadow-card p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
        <h1 className="text-3xl font-bold">My Courses</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="font-semibold text-red-800 dark:text-red-400">Error</h3>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button 
            onClick={loadCourses}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-blue-600 dark:text-blue-400" />
          My Courses
        </h1>
        {user?.role === 'admin' && (
          <div className="flex gap-3">
            <Button 
              onClick={() => setCreateOpen(true)}
              variant="outline"
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Course
            </Button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Courses</div>
              <div className="text-xl font-bold">{courses.length}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Students</div>
              <div className="text-xl font-bold">
                {courses.reduce((sum, course) => sum + (course.students_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-purple-600 mr-2" />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Modules</div>
              <div className="text-xl font-bold">
                {courses.reduce((sum, course) => sum + (course.modules_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState 
          title="No courses yet" 
          subtitle="Create your first course to start teaching"
        />
      ) : (
        <Card className="rounded-2xl-top shadow-card overflow-hidden">
          <CardHeader className="p-6">
            <CardTitle className="text-lg">Course Management</CardTitle>
            <CardDescription>Manage your courses and track progress</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800">
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Course</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modules</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completed</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Progress</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map(course => (
                  <TableRow key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">
                          {course.cover_image_url ? (
                            <img src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-medium">{course.title?.slice(0,1)?.toUpperCase() || 'C'}</span>
                          )}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">{course.title}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-medium">{course.modules_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-medium">{course.students_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-medium">{course.completed_count || 0}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-medium">{course.avg_progress ?? 0}%</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        course.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : course.status === 'draft'
                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                      }`}>
                        {course.status || 'Active'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex space-x-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          title="View course"
                          aria-label="View course"
                        >
                          <Link to={`/course/${course.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Edit course"
                            aria-label="Edit course"
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


