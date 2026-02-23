import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Clock, Search, Filter, ArrowRight } from 'lucide-react';

interface Course {
  id: number;
  title: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
}

interface StudentAnalytics {
  student_id: number;
  student_name: string;
  email: string;
  group_name?: string;
  progress_percentage: number;
  last_activity?: string;
  average_score?: number;
  current_lesson?: string;
  current_lesson_progress?: number;
  current_lesson_steps_completed?: number;
  current_lesson_steps_total?: number;
  last_test_result?: {
      title: string;
      score: number;
      max_score: number;
      percentage: number;
      type?: string;
      math_percent?: number;
      verbal_percent?: number;
      math_score?: number;
      math_max?: number;
      verbal_score?: number;
      verbal_max?: number;
  };
  completed_assignments?: number;
  total_assignments?: number;
  time_spent_minutes?: number;
}

interface GroupAnalytics {
    group_id: number;
    group_name: string;
    students_count: number;
    students_with_progress: number;
    average_completion_percentage: number;
    average_assignment_score_percentage: number;
    average_study_time_minutes: number;
    description?: string;
}

interface QuizError {
  step_id: number;
  lesson_id: number;
  question_id: string;
  total_attempts: number;
  wrong_answers: number;
  error_rate: number;
  question_text: string;
  question_type: string;
  lesson_title: string;
  step_title: string;
}

interface OverviewStats {
  total_students: number;
  active_students: number;
  average_progress: number;
  average_score: number;
  completion_rate: number;
}

interface VideoMetric {
  step_id: number;
  step_title: string;
  lesson_title: string;
  total_views: number;
  completed_views: number;
  completion_rate: number;
  average_watch_time_minutes: number;
}


export default function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filters derived from URL
  const selectedCourseId = searchParams.get('course_id') || '';
  const selectedGroupId = searchParams.get('group_id') || 'all';
  const activeTab = searchParams.get('tab') || 'overview';
  const studentSort = (searchParams.get('sort') as 'name' | 'progress' | 'activity') || 'progress';
  const studentSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'desc';

  // Filters State
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Data State
  const [rawOverviewData, setRawOverviewData] = useState<any>(null); // Store raw API response
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [groupsAnalytics, setGroupsAnalytics] = useState<GroupAnalytics[]>([]);
  const [quizErrors, setQuizErrors] = useState<QuizError[]>([]);
  const [courseLessons, setCourseLessons] = useState<Array<{id: string, title: string}>>([]);
  const [videoMetrics, setVideoMetrics] = useState<VideoMetric[]>([]);
  const [progressHistory, setProgressHistory] = useState<any[]>([]);
  const [quizSearch, setQuizSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState('all');
  
  // Granular Loading States
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Load - Get Courses
  useEffect(() => {
    loadCourses();
  }, []);

  // Effect: Fetch Course Data when Course ID changes
  useEffect(() => {
    if (selectedCourseId) {
      // 1. Fetch Groups for this course
      fetchCourseGroups(selectedCourseId);
      // 2. Fetch Overview (High Priority) - fetches ALL students for course
      fetchOverview(selectedCourseId);
      // 3. Fetch Charts (Lazy)
      fetchCharts(selectedCourseId);
      // 4. Fetch Lessons
      fetchCourseLessons(selectedCourseId);
    }
  }, [selectedCourseId]);

  // Effect: Recalculate Stats & Filter Students when Group ID or Raw Data changes
  // Effect: Recalculate Stats & Filter Students when Group ID or Raw Data changes
  useEffect(() => {
    if (rawOverviewData) {
        processRawData(rawOverviewData, selectedGroupId);
    }
    
    // Group-dependent data fetching
    if (selectedCourseId && selectedGroupId) {
         fetchCharts(selectedCourseId, selectedGroupId);
    }
  }, [selectedGroupId, rawOverviewData, groups, selectedCourseId]);

  // Separate effect for Quiz Errors to handle lesson filtering at the API level
  useEffect(() => {
    if (selectedCourseId && selectedGroupId) {
        fetchQuizErrors(selectedCourseId, selectedGroupId, lessonFilter);
    }
  }, [selectedCourseId, selectedGroupId, lessonFilter]);

  // Handlers for URL updates
  const handleCourseChange = (courseId: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('course_id', courseId);
      newParams.set('group_id', 'all'); // Reset group on course change
      setSearchParams(newParams);
      setLessonFilter('all');
      setCourseLessons([]);
  };

  const handleGroupChange = (groupId: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('group_id', groupId);
      setSearchParams(newParams);
  };

  const handleTabChange = (tab: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', tab);
      setSearchParams(newParams);
  };

  const handleSortChange = (field: 'name' | 'progress' | 'activity') => {
    const newParams = new URLSearchParams(searchParams);
    if (studentSort === field) {
        newParams.set('dir', studentSortDir === 'asc' ? 'desc' : 'asc');
    } else {
        newParams.set('sort', field);
        newParams.set('dir', 'desc');
    }
    setSearchParams(newParams);
  };

  const loadCourses = async () => {
    try {
      const coursesData = await apiClient.getCourses();
      const mappedCourses = coursesData.map((c: any) => ({ id: Number(c.id), title: c.title }));
      setCourses(mappedCourses);
      
      if (!selectedCourseId && mappedCourses.length > 0) {
         handleCourseChange(String(mappedCourses[0].id));
      } else if (mappedCourses.length === 0) {
        setError("No courses available to view.");
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      setError("Failed to load courses. Please try refreshing.");
    }
  };

  const fetchCourseGroups = async (courseId: string) => {
      setLoadingGroups(true);
      try {
          const groupsData = await apiClient.getCourseGroupsAnalytics(String(courseId));
          const mappedGroups = (groupsData.groups || []).map((g: any) => ({
            id: g.group_id,
            name: g.group_name,
            description: g.description
          }));
          setGroups(mappedGroups);
          
          if (selectedGroupId !== 'all' && !mappedGroups.find((g: any) => String(g.id) === selectedGroupId)) {
              handleGroupChange('all'); 
          }
          
          setGroupsAnalytics(groupsData.groups || []);
      } catch (err) {
          console.error("Failed to load course groups", err);
      } finally {
          setLoadingGroups(false);
      }
  };

  const fetchOverview = async (courseId: string) => {
    setLoadingOverview(true);
    try {
        const data = await apiClient.getCourseAnalyticsOverview(courseId);
        setRawOverviewData(data); // Store raw data for client-side filtering
        // Processing happens in useEffect
    } catch (err) {
        console.error("Failed to fetch overview", err);
    } finally {
        setLoadingOverview(false);
    }
  };

  // Helper to filter and calculate stats locally
  const processRawData = (data: any, groupId: string) => {
      let rawStudents = data.student_performance || [];

      // Filter by Group
      if (groupId !== 'all') {
           // We try to match by Group Name if possible, as student data might use names
           const targetGroup = groups.find(g => String(g.id) === groupId);
           if (targetGroup) {
               // Normalizing comparison: backend might send group_name
               rawStudents = rawStudents.filter((s: any) => s.group_name === targetGroup.name || s.group_name === targetGroup.description);
           }
      }

      // Calculate Stats based on FILTERED students
      const avgScore = rawStudents.length > 0 
        ? rawStudents.reduce((sum: number, s: any) => sum + (s.assignment_score_percentage || 0), 0) / rawStudents.length 
        : 0;
      
      const avgProgress = rawStudents.length > 0
        ? rawStudents.reduce((sum: number, s: any) => sum + (s.completion_percentage || 0), 0) / rawStudents.length
        : 0;

      const activeCount = rawStudents.filter((s: any) => s.last_activity).length;

      setOverview({
        total_students: rawStudents.length,
        active_students: activeCount,
        average_progress: avgProgress,
        average_score: avgScore,
        completion_rate: avgProgress, // Usually similar to progress
      });

      // Map Students for Table
      const mappedStudents = rawStudents.map((s: any) => ({
        student_id: s.student_id,
        student_name: s.student_name,
        email: s.email || '',
        group_name: s.group_name,
        progress_percentage: s.completion_percentage || 0,
        last_activity: s.last_activity,
        average_score: s.assignment_score_percentage || s.average_score,
        current_lesson: s.current_lesson,
        current_lesson_progress: s.current_lesson_progress,
        last_test_result: s.last_test_result,
        completed_assignments: s.completed_assignments,
        total_assignments: s.total_assignments,
        time_spent_minutes: s.time_spent_minutes
      }));
      
      setStudents(mappedStudents);
  };

  const fetchQuizErrors = async (courseId: string, groupId: string, lessonId?: string) => {
       try {
           const groupIdNum = groupId !== 'all' ? Number(groupId) : undefined;
           const lessonIdNum = lessonId && lessonId !== 'all' ? Number(lessonId) : undefined;
           const errorsData = await apiClient.getQuizErrors(courseId, groupIdNum, 300, lessonIdNum);
           setQuizErrors(errorsData.questions || []);
       } catch (err) {
           console.error("Failed to fetch quiz errors", err);
       }
  };

  const fetchCourseLessons = async (courseId: string) => {
      try {
          const lessonsData = await apiClient.getCourseLessons(courseId);
          setCourseLessons(lessonsData.map((l: any) => ({
              id: String(l.id),
              title: l.title
          })));
      } catch (err) {
          console.error("Failed to fetch course lessons", err);
      }
  };

  const fetchCharts = async (courseId: string, groupId?: string) => {
      setLoadingCharts(true);
      try {
          const [videoData, , progressData] = await Promise.all([
            apiClient.getVideoEngagementAnalytics(courseId),
            apiClient.getQuizPerformanceAnalytics(courseId),
            apiClient.getCourseProgressHistory(courseId, groupId)
          ]);

          setVideoMetrics(videoData.video_analytics || []);
          setProgressHistory(progressData || []);
          
          setProgressHistory(progressData || []);

      } catch (err) {
          console.error("Failed to fetch charts", err);
      } finally {
          setLoadingCharts(false);
      }
  };



  // Derived Data: Filtered Quiz Errors (Questions) for the Quizzes Tab
  const filteredQuizErrors = useMemo(() => {
    return quizErrors.filter(err => {
        const matchesSearch = err.question_text.toLowerCase().includes(quizSearch.toLowerCase()) || 
                             err.step_title.toLowerCase().includes(quizSearch.toLowerCase());
        return matchesSearch;
    });
  }, [quizErrors, quizSearch]);

  // Derived Data: Topics Analysis (Grouped by Lesson)
  const topicAnalysis = useMemo(() => {
      const topics: Record<string, { id: number, title: string, errors: number, attempts: number, questions: number }> = {};
      quizErrors.forEach(err => {
          if (!topics[err.lesson_id]) {
              topics[err.lesson_id] = { id: err.lesson_id, title: err.lesson_title, errors: 0, attempts: 0, questions: 0 };
          }
          topics[err.lesson_id].errors += err.wrong_answers;
          topics[err.lesson_id].attempts += err.total_attempts;
          topics[err.lesson_id].questions += 1;
      });
      return Object.values(topics)
        .map(t => ({
            ...t,
            errorRate: t.attempts > 0 ? (t.errors / t.attempts) * 100 : 0
        }))
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 200);
  }, [quizErrors]);


  // Derived Data: Sorted Students
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let cmp = 0;
      if (studentSort === 'name') {
        cmp = a.student_name.localeCompare(b.student_name);
      } else if (studentSort === 'progress') {
        cmp = a.progress_percentage - b.progress_percentage;
      } else if (studentSort === 'activity') {
        const aTime = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const bTime = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        cmp = aTime - bTime;
      }
      return studentSortDir === 'desc' ? -cmp : cmp;
    });
  }, [students, studentSort, studentSortDir]);

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (minutes?: number) => {
      if (!minutes) return '-';
      if (minutes < 60) return `${Math.round(minutes)}m`;
      return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  const formatQuestionType = (type: string) => {
    switch (type) {
        case 'choice':
        case 'multiple_choice':
            return 'Multiple Choice';
        case 'multi_choice':
            return 'Multiple Selection';
        case 'fill_blank':
            return 'Fill in the Blank';
        case 'long_text':
            return 'Open Ended';
        default:
            return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
    }
  };


  if (!user || !['teacher', 'curator', 'admin'].includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400">You don't have permission to view analytics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (courses.length === 0 && !loadingOverview) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-2">No courses found</h2>
        <p className="text-gray-500 dark:text-gray-400">You don't have access to any courses yet.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">{user?.role === 'head_curator' ? 'Аналитика' : 'Analytics'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{user?.role === 'head_curator' ? 'Отслеживание прогресса студентов и эффективности курсов' : 'Monitor student progress and course performance'}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select 
            value={selectedCourseId} 
             onValueChange={handleCourseChange}
          >
            <SelectTrigger className="w-full sm:w-[280px] bg-white dark:bg-card">
              <SelectValue placeholder={user?.role === 'head_curator' ? "Выберите курс" : "Select course"} />
            </SelectTrigger>
            <SelectContent>
              {courses.map(course => (
                <SelectItem key={course.id} value={String(course.id)}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedGroupId} 
             onValueChange={handleGroupChange}
             disabled={loadingGroups}
          >
<SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-card">
            <SelectValue placeholder={user?.role === 'head_curator' ? "Фильтр по группе" : "Filter by group"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{user?.role === 'head_curator' ? "Все группы" : "All Groups"}</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.description || group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative" role="alert">
           <strong className="font-bold">Error: </strong>
           <span className="block sm:inline">{error}</span>
        </div>
      )}

      {loadingOverview ? (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-[100px]" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-[60px]" />
                </CardContent>
              </Card>
            ))}
         </div>
      ) : overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{user?.role === 'head_curator' ? "Всего студентов" : "Total Students"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.total_students}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.active_students} active recently
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{user?.role === 'head_curator' ? "Средний прогресс" : "Avg. Progress"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.average_progress)}%</div>
              <Progress value={overview.average_progress} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{user?.role === 'head_curator' ? "Средний балл" : "Avg. Score"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.average_score)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Assignment performance
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{user?.role === 'head_curator' ? "Процент завершения" : "Completion Rate"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.completion_rate)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Course completion
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="overview">{user?.role === 'head_curator' ? "Обзор" : "Overview"}</TabsTrigger>
          <TabsTrigger value="students">{user?.role === 'head_curator' ? "Студенты" : "Students"}</TabsTrigger>
          <TabsTrigger value="groups">{user?.role === 'head_curator' ? "Группы" : "Groups"}</TabsTrigger>
          <TabsTrigger value="quizzes">{user?.role === 'head_curator' ? "Тесты" : "Quizzes"}</TabsTrigger>
          <TabsTrigger value="topics">{user?.role === 'head_curator' ? "Темы" : "Topics"}</TabsTrigger>
          <TabsTrigger value="engagement">{user?.role === 'head_curator' ? "Активность" : "Engagement"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 items-start">
            <Card className="col-span-7 lg:col-span-4">
              <CardHeader>
                <CardTitle>Progress Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                {selectedGroupId === 'all' ? (
                    <div className="h-[350px] flex items-center justify-center text-gray-400 font-medium">
                        Select group first
                    </div>
                ) : loadingCharts ? (
                    <div className="h-[350px] flex items-center justify-center">
                        <Skeleton className="h-[300px] w-full" />
                    </div>
                ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={progressHistory}>
                          <defs>
                            <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => {
                                // Format date as "MMM dd" (e.g., Jan 15)
                                if (!value) return '';
                                const date = new Date(value);
                                return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            }}
                          />
                          <YAxis 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value}%`} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                                background: '#fff', 
                                border: 'none', 
                                borderRadius: '8px', 
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="progress" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorProgress)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-7 lg:col-span-3">
              <CardHeader>
                <CardTitle>Difficult Lessons</CardTitle>
                <CardDescription>
                   Lessons with highest error rates.
                   <span className="block text-[10px] mt-1 text-gray-400 italic">
                     (Calculation: total incorrect question answers / total attempts)
                   </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCharts ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : topicAnalysis.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">No data available</div>
                ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {topicAnalysis.slice(0, 50).map((topic) => (
                        <div key={topic.id} className="flex items-center">
                            <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-foreground break-words" title={topic.title}>
                                    {topic.title}
                                </p>
                                <Badge variant={topic.errorRate > 70 ? "destructive" : "secondary"}>
                                    {Math.round(topic.errorRate)}% error
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                {topic.questions} questions • {topic.attempts} attempts
                            </p>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Progress Directory</CardTitle>
              <CardDescription>
                Detailed progress tracking for {students.length} students
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGroups ? ( // Use loadingGroups as a proxy for raw data processing buffer or implement specific loading state
                 <div className="space-y-2">
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-20 w-full" />
                     <Skeleton className="h-20 w-full" />
                     <Skeleton className="h-20 w-full" />
                 </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] cursor-pointer hover:bg-gray-100 dark:hover:bg-secondary" onClick={() => handleSortChange('name')}>
                      Student {studentSort === 'name' && (studentSortDir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-center">Group</TableHead>
                    <TableHead className="cursor-pointer hover:bg-gray-100 dark:hover:bg-secondary" onClick={() => handleSortChange('progress')}>
                      Progress {studentSort === 'progress' && (studentSortDir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>Current Lesson</TableHead>
                    {courses.find(c => c.id.toString() === selectedCourseId)?.title.toLowerCase().includes('sat') ? (
                      <TableHead className="w-[120px]">Weekly Test</TableHead>
                    ) : (
                      <TableHead className="w-[180px]">Last Test</TableHead>
                    )}
                    <TableHead className="text-center">Assignments</TableHead>
                    <TableHead className="text-center">Time Spent</TableHead>
                    <TableHead className="cursor-pointer hover:bg-gray-100 dark:hover:bg-secondary" onClick={() => handleSortChange('activity')}>
                      Last Active {studentSort === 'activity' && (studentSortDir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((student) => (
                    <TableRow 
                      key={student.student_id}
                      className="hover:bg-gray-50 dark:hover:bg-secondary/50 cursor-pointer group py-0"
                      onClick={() => navigate(`/analytics/student/${student.student_id}?course_id=${selectedCourseId}`)}
                    >
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-foreground">{student.student_name}</p>
                          <p className="text-gray-500 dark:text-gray-400">{student.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2 pr-0">
                        <Badge variant="outline" className="font-normal text-gray-500 dark:text-gray-400 text-xs px-2 py-0 h-6">
                            {groups.find(g => g.name === student.group_name)?.description || student.group_name || 'No Group'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={student.progress_percentage} className="h-2 w-16" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{Math.round(student.progress_percentage)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                         <div className="flex flex-col gap-1 max-w-[200px]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium" title={student.current_lesson || 'Not started'}>
                                   {student.current_lesson || 'Not started'}
                                </span>
                            </div>
                            {student.current_lesson && student.current_lesson !== 'Not started' && (
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                        <div 
                                            className="bg-blue-500 h-1.5 rounded-full" 
                                            style={{ width: `${student.current_lesson_progress || 0}%` }}
                                        />
                                    </div>
                                    {(student.current_lesson_steps_total || 0) > 0 && (
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap min-w-[30px] text-right">
                                            {student.current_lesson_steps_completed || 0}/{student.current_lesson_steps_total}
                                        </span>
                                    )}
                                </div>
                            )}
                         </div>
                      </TableCell>
                      {courses.find(c => c.id.toString() === selectedCourseId)?.title.toLowerCase().includes('sat') ? (
                          <TableCell className="py-2">
                             <div className="flex flex-col gap-0.5 text-xs text-gray-700 dark:text-gray-300">
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400 mr-1">Verbal:</span>
                                    {student.last_test_result?.verbal_score != null ?
                                        `${student.last_test_result.verbal_score}/${student.last_test_result.verbal_max || 0}`
                                        : '-'
                                    }
                                </div>
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400 mr-2.5">Math:</span>
                                    {student.last_test_result?.math_score != null ?
                                        `${student.last_test_result.math_score}/${student.last_test_result.math_max || 0}`
                                        : '-'
                                    }
                                </div>
                             </div>
                          </TableCell>
                      ) : (
                        <TableCell className="py-2">
                           {student.last_test_result ? (
                              <div className="flex flex-col gap-1">
                                  <span className="text-xs font-medium text-gray-900 dark:text-foreground truncate max-w-[120px]" title={student.last_test_result.title}>
                                      {student.last_test_result.title}
                                  </span>
                                  <span className={`text-xs font-bold ${
                                      student.last_test_result.percentage >= 80 ? 'text-green-600' : 
                                      student.last_test_result.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                      {student.last_test_result.percentage}%
                                  </span>
                              </div>
                           ) : (
                              <span className="text-xs text-gray-400">-</span>
                           )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                         <div className="text-sm">
                            <span className="font-medium">{student.completed_assignments || 0}</span>
                            <span className="text-gray-400">/{student.total_assignments || 0}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(student.time_spent_minutes)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTimeAgo(student.last_activity)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600">
                            Details &rarr;
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedStudents.length === 0 && (
                     <TableRow>
                         <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">
                             No students found matching current filters.
                         </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
           {loadingGroups ? <Skeleton className="h-[200px] w-full" /> : (
            <Card>
              <CardHeader>
                <CardTitle>Course Groups</CardTitle>
                <CardDescription>Overview of performance by group</CardDescription>
              </CardHeader>
              <CardContent>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Group Name</TableHead>
                     <TableHead>Students</TableHead>
                     <TableHead>Avg. Completion</TableHead>
                     <TableHead>Avg. Score</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                  {groupsAnalytics.map(group => (
                    <TableRow key={group.group_id}>
                      <TableCell className="font-medium">
                        {group.description || group.group_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                            <span>{group.students_count}</span>
                            <span className="text-gray-400 text-xs">students</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            <Progress value={group.average_completion_percentage} className="h-2 w-16" />
                            <span className="text-sm font-medium">{Math.round(group.average_completion_percentage)}%</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <span className="font-medium">{Math.round(group.average_assignment_score_percentage)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => {
                                handleTabChange('students');
                                handleGroupChange(String(group.group_id));
                            }}
                         >
                            View Students &rarr;
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {groupsAnalytics.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                              No groups found.
                          </TableCell>
                      </TableRow>
                  )}
                 </TableBody>
               </Table>
              </CardContent>
            </Card>
           )}
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white dark:bg-card p-4 rounded-xl border border-gray-100 dark:border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-auto flex-1">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Search className="h-3 w-3" />
                            Search Questions
                        </label>
                        <input 
                            type="text"
                            placeholder="Search by keyword..."
                            className="w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border dark:text-foreground dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                            value={quizSearch}
                            onChange={(e) => setQuizSearch(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Filter className="h-3 w-3" />
                            Filter by Lesson
                        </label>
                        <Select value={lessonFilter} onValueChange={setLessonFilter}>
                            <SelectTrigger className="w-full bg-white dark:bg-card border-gray-200 dark:border-border">
                                <SelectValue placeholder="All Lessons" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lessons ({courseLessons.length})</SelectItem>
                                {courseLessons.map(lesson => (
                                    <SelectItem key={lesson.id} value={lesson.id}>{lesson.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="h-9 px-3 font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800">
                        {filteredQuizErrors.length} Questions Analyzed
                    </Badge>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white dark:bg-card border-b border-gray-100 dark:border-border py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div>
                                <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">Difficult Quiz Questions</CardTitle>
                                <CardDescription>Questions with the highest error rates across the selected group</CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-transparent hover:bg-transparent border-b">
                                    <TableHead className="w-[35%] py-4 text-xs font-medium text-gray-400">Question</TableHead>
                                    <TableHead className="w-[15%] py-4 text-xs font-medium text-gray-400">Type</TableHead>
                                    <TableHead className="w-[20%] py-4 text-xs font-medium text-gray-400">Context</TableHead>
                                    <TableHead className="w-[10%] py-4 text-center text-xs font-medium text-gray-400">Attempts</TableHead>
                                    <TableHead className="w-[10%] py-4 text-center text-xs font-medium text-gray-400">Error</TableHead>
                                    <TableHead className="w-[10%] py-4 text-right text-xs font-medium text-gray-400"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingCharts ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredQuizErrors.length > 0 ? (
                                    filteredQuizErrors.map((error, idx) => (
                                        <TableRow key={`${error.step_id}-${error.question_id}-${idx}`} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100/50 dark:border-border">
                                            <TableCell className="py-5">
                                                <div className="max-w-md">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-foreground leading-snug line-clamp-2" title={error.question_text}>
                                                        {error.question_text || "Untitled Question"}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider bg-gray-50 dark:bg-secondary border-gray-200 dark:border-border text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {formatQuestionType(error.question_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                                                    {error.lesson_title} <span className="text-gray-300 mx-1">•</span> {error.step_title}
                                                </p>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{error.total_attempts}</span>
                                            </TableCell>
                                            <TableCell className="py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`text-sm font-bold ${
                                                        error.error_rate > 60 ? 'text-red-600' : 
                                                        error.error_rate > 30 ? 'text-amber-600' : 
                                                        error.error_rate > 0 ? 'text-blue-600' : 'text-green-600'
                                                    }`}>
                                                        {Number(error.error_rate).toFixed(1)}%
                                                    </span>
                                                    <div className="w-12 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                error.error_rate > 60 ? 'bg-red-500' : 
                                                                error.error_rate > 30 ? 'bg-amber-500' : 
                                                                error.error_rate > 0 ? 'bg-blue-500' : 'bg-green-500'
                                                            }`}
                                                            style={{ width: `${Math.max(error.error_rate, 2)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <Link 
                                                    to={`/course/${selectedCourseId}/lesson/${error.lesson_id}?stepId=${error.step_id}&questionId=${error.question_id}`}
                                                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium gap-1 group/btn pr-2"
                                                >
                                                    View
                                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="p-4 bg-gray-50 dark:bg-secondary rounded-full">
                                                    <XAxis className="h-8 w-8 text-gray-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-lg font-semibold text-gray-900 dark:text-foreground">No difficult questions found</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms</p>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => { setQuizSearch(''); setLessonFilter('all'); }}
                                                >
                                                    Clear All Filters
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

        </TabsContent>

        <TabsContent value="topics">
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Problematic Topics</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {topicAnalysis.map((topic, i) => (
                    <Card key={i}>
                      <CardHeader>
                         <CardTitle className="text-base">{topic.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Error Rate</span>
                            <Badge variant={topic.errorRate > 50 ? "destructive" : "secondary"}>{Math.round(topic.errorRate)}%</Badge>
                         </div>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Total Errors</span>
                            <span className="font-medium text-red-600">{topic.errors}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Questions</span>
                            <span className="font-medium">{topic.questions}</span>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                  {topicAnalysis.length === 0 && (
                      <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">No topic analysis available due to lack of error data.</div>
                  )}
                </div>
             </div>
        </TabsContent>
        
        <TabsContent value="engagement">
             {loadingCharts ? <Skeleton className="h-[300px]" /> : (
                 <div className="space-y-4">
                     {videoMetrics.map(video => (
                         <div key={video.step_id} className="flex items-center justify-between p-4 border rounded-lg">
                             <div>
                                 <h4 className="font-medium">{video.lesson_title}</h4>
                                 <p className="text-sm text-gray-500 dark:text-gray-400">{video.step_title}</p>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold">{video.total_views} Views</div>
                                 <div className="text-xs text-gray-500 dark:text-gray-400">{Math.round(video.average_watch_time_minutes)} mins avg</div>
                             </div>
                         </div>
                     ))}
                     {videoMetrics.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No video engagement data available</div>}
                 </div>
             )}
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
