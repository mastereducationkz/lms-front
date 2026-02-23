import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChevronRight, Play, FileText, HelpCircle, Clock, Users, CheckCircle, Lock } from 'lucide-react';
import apiClient from '../services/api';
import type { Course, Lesson } from '../types';

import { Progress } from '../components/ui/progress';

export default function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMinutes} minutes`;
  };

  const calculateProgress = () => {
    if (!modules.length) return 0;

    let totalLessons = 0;
    let completedLessons = 0;

    modules.forEach(module => {
      const lessons = module.lessons || [];
      totalLessons += lessons.length;
      completedLessons += lessons.filter((l: any) => l.is_completed).length;
    });

    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };

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
      setError('Failed to load course data');
    } finally {
      setIsLoading(false);
    }
  };

  const getLessonIcon = (lesson: Lesson) => {
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
      alert('Complete previous lessons first to unlock this lesson');
      return;
    }
    
    navigate(`/course/${courseId}/lesson/${lesson.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-300">{error || 'Course not found'}</p>
          <Button onClick={() => navigate('/courses')} className="mt-4">
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Course Info (not a header) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{course.title}</h1>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-300">{course.description}</p>

            {/* Progress Bar */}
            <div className="mt-6 max-w-xl">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                <span className="font-medium">Course Progress</span>
                <span className="font-medium">{calculateProgress()}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>

            <div className="mt-6 flex items-center space-x-4">
              {course.estimated_duration_minutes && course.estimated_duration_minutes > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(course.estimated_duration_minutes)}
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {modules.length} modules
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
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
                          Completed
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{module.description}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                    {module.total_lessons} lessons
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {module.lessons && module.lessons.length > 0 ? (
                  <div className="space-y-3">
                    {module.lessons.map((lesson: any) => {
                      const isAccessible = (lesson as any).is_accessible !== false;
                      
                      return (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        disabled={!isAccessible}
                        title={!isAccessible ? "Complete previous lessons to unlock" : ""}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                          !isAccessible
                            ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-secondary border-gray-200 dark:border-border'
                            : lesson.is_completed
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-border hover:bg-gray-100 dark:hover:bg-secondary'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`flex-shrink-0 ${
                            !isAccessible 
                              ? 'text-gray-400 dark:text-gray-500' 
                              : lesson.is_completed 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-gray-400 dark:text-gray-500'
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
                            <h3 className={`font-medium ${lesson.is_completed ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-white'}`}>
                              {lesson.title}
                            </h3>
                            {lesson.description && (
                              <p className={`text-sm mt-1 ${lesson.is_completed ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {lesson.description}
                              </p>
                            )}
                            {lesson.steps && lesson.steps.length > 0 && (
                              <p className={`text-xs mt-1 ${lesson.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {lesson.steps.length} steps
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 ${lesson.is_completed ? 'text-green-400' : 'text-gray-400'}`} />
                      </button>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No lessons in this module yet.</p>
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


