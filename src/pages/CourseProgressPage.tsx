import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ChevronDown, ChevronUp, BookOpen, Users, Clock, CheckCircle } from 'lucide-react';
import apiClient from '../services/api';
import type { CourseStepsProgress } from '../types';

export default function CourseProgressPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [progressData, setProgressData] = useState<CourseStepsProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (courseId) {
      loadProgressData();
    }
  }, [courseId]);

  const loadProgressData = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getCourseStudentsStepsProgress(courseId!);
      setProgressData(data);
    } catch (error) {
      console.error('Failed to load progress data:', error);
      setError('Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModuleExpanded = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (error || !progressData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Error</h2>
          <p className="text-muted-foreground">{error || 'Progress data not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Progress Report: {progressData.course_title}
        </h1>
        <div className="flex items-center gap-6 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span>{progressData.total_students} students</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span>{progressData.modules.length} modules</span>
          </div>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progressData.total_students}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progressData.modules.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {progressData.modules.reduce((total, module) => total + module.lessons.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Progress */}
      <div className="space-y-6">
        {progressData.modules.map((module) => (
          <Card key={module.module_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-brand" />
                  <div>
                    <CardTitle className="text-lg">{module.module_title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{module.lessons.length} lessons</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleModuleExpanded(module.module_id)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  {expandedModules.has(module.module_id) ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>
              </div>
            </CardHeader>
            
            {expandedModules.has(module.module_id) && (
              <CardContent>
                <div className="space-y-4">
                  {module.lessons.map((lesson) => (
                    <div key={lesson.lesson_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">{lesson.lesson_title}</h3>
                        <Badge variant="outline">
                          {lesson.total_steps} steps
                        </Badge>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Completed Steps</TableHead>
                            <TableHead>Time Spent</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lesson.students_progress.map((student) => (
                            <TableRow key={student.student_id}>
                              <TableCell className="font-medium">
                                {student.student_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={student.completion_percentage} 
                                    className="w-20"
                                  />
                                  <span className={`text-sm ${getProgressColor(student.completion_percentage)}`}>
                                    {Math.round(student.completion_percentage)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <span>
                                    {student.completed_steps}/{student.total_steps}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span>{student.time_spent_minutes} min</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={student.completion_percentage === 100 ? "default" : "secondary"}
                                  className={student.completion_percentage === 100 ? "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300" : ""}
                                >
                                  {student.completion_percentage === 100 ? "Completed" : "In Progress"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
