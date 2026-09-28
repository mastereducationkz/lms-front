import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import apiClient from "../services/api";
import ProgressBar from '../components/ProgressBar';
import Breadcrumbs from '../components/Breadcrumbs.tsx';
import Skeleton from '../components/Skeleton.tsx';
import type { CourseModule, Lesson, Course } from '../types';
import { Clock, Play } from 'lucide-react';

export default function ModulePage() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<CourseModule | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !moduleId) {
      navigate('/courses');
      return;
    }
    loadModuleData();
  }, [courseId, moduleId, navigate]);

  const loadModuleData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!courseId || !moduleId) return;


      // Load course data
      const courseData = await apiClient.getCourse(courseId);
      setCourse(courseData);

      // Load all modules for the course to find the specific module
      const modules = await apiClient.getCourseModules(courseId);
      
      // Fix type comparison - moduleId from URL is string, but m.id is number
      const targetModule = modules.find(m => {
        const moduleIdNum = parseInt(moduleId);
        const isMatch = m.id === moduleIdNum;
        return isMatch;
      });
      
      console.log('🎯 Target module found:', targetModule);
      
      if (!targetModule) {
        console.error('❌ Module not found. Available modules:', modules.map(m => ({ id: m.id, title: m.title })));
        setError(`Module not found. Available modules: ${modules.map(m => m.title).join(', ')}`);
        return;
      }

      setModule(targetModule);

      // Load lessons for this module
      const moduleLessons = await apiClient.getModuleLessons(courseId, parseInt(moduleId));
      console.log('📖 Module lessons:', moduleLessons);
      setLessons(moduleLessons);

      // Calculate progress (for students)
      if (user?.role === 'student') {
        const completedLessons = moduleLessons.filter(lesson => lesson.is_completed).length;
        const totalLessons = moduleLessons.length;
        setProgress(totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0);
      }
      
    } catch (err) {
      setError((err as any).message || 'Failed to load module data');
      console.error('Failed to load module data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLessonStatus = (lessonId: string): 'not-started' | 'in-progress' | 'completed' => {
    const progress = progressByLesson[lessonId];
    if (!progress) return 'not-started';
    if (progress.status === 'completed') return 'completed';
    return 'in-progress';
  };

  // Helper function to get lesson type from steps or fallback
  const getLessonType = (lesson: any): string => {
    if (!lesson) return 'Video lesson';
    
    // Try to get from steps first
    if (Array.isArray(lesson.steps) && lesson.steps.length > 0) {
      const stepType = lesson.steps[0].content_type;
      // Map step content_type to display name
      switch (stepType) {
        case 'video_text': return 'Video lesson';
        case 'text': return 'Text lesson';
        case 'quiz': return 'Quiz lesson';
        default: return 'Video lesson';
      }
    }
    
    // Fallback to legacy content_type
    return (lesson as any).content_type || 'Video lesson';
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-80" />
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-4" />
          <div className="card p-5">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
        <div>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h3 className="font-semibold text-red-800">Error loading module</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadModuleData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!module || !course) {
    return <div className="text-gray-500">Module not found</div>;
  }

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[
        { to: '/dashboard', label: 'Dashboard' }, 
        { to: '/courses', label: 'Courses' }, 
        { to: `/course/${courseId}`, label: course.title },
        { label: module.title }
      ]} />
      
      <div>
        <h1 className="text-3xl font-bold">{module.title}</h1>
        <p className="text-gray-600 mt-1">{module.description}</p>
        {user?.role === 'student' && (
          <div className="mt-4 card p-5">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Module Progress</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Lessons</h2>
        {lessons.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No lessons available</p>
            <p className="text-sm mt-2">This module doesn't have any lessons yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, idx) => (
              <div key={lesson.id} className="card p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-lg">{lesson.title}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Play className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                        {getLessonType(lesson)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                        {lesson.duration_minutes || 0} minutes
                      </span>
                    </div>
                  </div>
                </div>
                <Link 
                  to={`/lecture/${lesson.id}`} 
                  className="btn-primary text-sm"
                >
                  {getLessonStatus(lesson.id) === 'completed' ? 'Review' : 'Start'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


