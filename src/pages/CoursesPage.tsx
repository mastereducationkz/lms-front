import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import Skeleton from '../components/Skeleton.tsx';
import apiClient from "../services/api";
import type { Course } from '../types';
import { BookOpen, Target, CheckCircle, Play } from 'lucide-react';

interface CourseCard {
  id: string;
  title: string;
  teacher: string;
  image?: string;
  progress?: number;
  status?: string;
  modules: number;
  description: string;
  duration?: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let coursesData: CourseCard[];
      if (user?.role === 'student') {
        // For students, get their progress overview with detailed course data
        const progressOverview = await apiClient.getStudentProgressOverview();
        // Transform the data to match Card component expectations
        coursesData = progressOverview.courses.map((course: any) => ({
          id: course.course_id.toString(),
          title: course.course_title,
          teacher: course.teacher_name,
          image: course.cover_image_url ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + course.cover_image_url : undefined,
          progress: course.completion_percentage,
          status: course.completion_percentage === 100 ? 'completed' : course.completion_percentage > 0 ? 'in_progress' : 'not_started',
          modules: course.total_lessons, // Using lessons as modules for display
          description: `${course.total_lessons} lessons, ${course.total_steps} steps`
        }));
      } else {
        // For teachers/admins, get all courses they have access to
        const allCourses = await apiClient.getCourses();
        coursesData = allCourses.map((course: Course) => ({
          id: course.id,
          title: course.title,
          teacher: course.teacher?.name || 'Unknown',
          image: course.image,
          description: course.description,
          modules: 0, // This would need to come from API
          duration: 0 // This would need to come from API
        }));
      }
      
      setCourses(coursesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load courses';
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        <h2 className="text-2xl sm:text-3xl font-bold">Courses</h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-400">Error loading courses</h3>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button 
            onClick={loadCourses}
            variant="destructive"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold">Courses</h2>
        {user?.role === 'teacher' && (
          <Button 
            onClick={() => navigate('/teacher/courses')}
            className="px-4 py-2 w-full sm:w-auto"
          >
            Manage Courses
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No courses available</p>
          {user?.role === 'student' && (
            <p className="text-sm mt-2">Contact your teacher to get enrolled in courses</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {courses.map(course => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              {/* Course Image */}
              {course.image ? (
                <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.style.display = 'none';
                    }}
                  />
                  {/* Progress Overlay for students */}
                  {user?.role === 'student' && course.progress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <div className="flex items-center justify-between text-white">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-bold">{course.progress}%</span>
                      </div>
                      <Progress 
                        value={course.progress} 
                        className="h-1 mt-2"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-center text-white">
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-80" />
                    <div className="text-sm font-medium opacity-90">{course.title}</div>
                  </div>
                  {/* Progress Overlay for students */}
                  {user?.role === 'student' && course.progress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <div className="flex items-center justify-between text-white">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-bold">{course.progress}%</span>
                      </div>
                      <Progress 
                        value={course.progress} 
                        className="h-1 mt-2"
                      />
                    </div>
                  )}
                </div>
              )}
              
              <CardHeader className="pb-3">
                <CardTitle className="text-lg truncate">{course.title}</CardTitle>
                <CardDescription className="text-sm">
                  Teacher: {course.teacher}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar - Only show if no image and student */}
                {!course.image && user?.role === 'student' && course.progress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Course progress</span>
                      <span className={`font-medium ${getProgressColor(course.progress)}`}>
                        {course.progress}%
                      </span>
                    </div>
                    <Progress 
                      value={course.progress} 
                      className="h-2"
                    />
                  </div>
                )}
                {/* Course Info */}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {course.description}
                </div>
                {/* Action Button */}
                <Button 
                  onClick={() => navigate(`/course/${course.id}`)}
                  className="w-full"
                  variant={user?.role === 'student' && course.progress === 100 ? "outline" : "default"}
                >
                  {user?.role === 'student' ? (
                    course.progress === 100 ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Course completed
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Continue learning
                      </>
                    )
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      View course
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
