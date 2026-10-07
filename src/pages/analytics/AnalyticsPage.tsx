import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Clock, Search, Filter, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import '@/lib/i18n/catalogs/analytics';
import '@/lib/i18n/catalogs/teacherInsights';

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
    is_inactive?: boolean;
  student_id: number;
  student_name: string;
  email: string;
  group_ids?: number[];
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
    is_archived?: boolean;
    teacher_name?: string | null;
    curator_name?: string | null;
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


/** The active column's sort direction, drawn rather than a ↑/↓ glyph. */
function SortMark({ dir }: { dir: string }) {
  const t = useT();
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return <Icon className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-label={dir === 'asc' ? t('teacherInsights.analytics.sortAscending') : t('teacherInsights.analytics.sortDescending')} />;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filters derived from URL
  const selectedCourseId = searchParams.get('course_id') || '';
  const selectedGroupId = searchParams.get('group_id') || 'all';
  const activeTab = searchParams.get('tab') || 'overview';
  const studentSort = (searchParams.get('sort') as 'name' | 'progress' | 'activity') || 'progress';
  const studentSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'desc';
  const studentPage = Number(searchParams.get('page') || '1');
  const studentPageSize = Number(searchParams.get('page_size') || '100');

  // Filters State
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Data State
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [groupsAnalytics, setGroupsAnalytics] = useState<GroupAnalytics[]>([]);
  const [quizErrors, setQuizErrors] = useState<QuizError[]>([]);
  const [courseLessons, setCourseLessons] = useState<Array<{id: string, title: string}>>([]);
  const [videoMetrics, setVideoMetrics] = useState<VideoMetric[]>([]);
  const [progressHistory, setProgressHistory] = useState<any[]>([]);
  const [studentsPagination, setStudentsPagination] = useState<{ page: number; page_size: number; total_items: number; total_pages: number } | null>(null);
  const [quizSearch, setQuizSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState('all');
  
  // Granular Loading States
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const debouncedStudentSearch = useDebouncedValue(studentSearch, 350);
  const [groupSearch, setGroupSearch] = useState('');
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Load - Get Courses
  useEffect(() => {
    loadCourses();
  }, []);

  const needsChartData = activeTab === 'overview' || activeTab === 'engagement';
  const needsQuizData = activeTab === 'quizzes' || activeTab === 'topics' || activeTab === 'overview';

  // Effect: refetch the group list when the archived toggle flips
  useEffect(() => {
    if (selectedCourseId) fetchCourseGroups(selectedCourseId, showArchivedGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedGroups]);

  // Effect: Fetch Course Data when Course ID changes
  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseGroups(selectedCourseId);
      fetchOverview(selectedCourseId);
      if (needsChartData) {
        fetchCharts(selectedCourseId, selectedGroupId);
      }
      if (needsQuizData) {
        fetchCourseLessons(selectedCourseId);
        fetchQuizErrors(selectedCourseId, selectedGroupId, lessonFilter);
      }
    }
  }, [selectedCourseId, needsChartData, needsQuizData, selectedGroupId, lessonFilter]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    fetchOverview(selectedCourseId);
  }, [selectedCourseId, selectedGroupId, studentSort, studentSortDir, studentPage, studentPageSize, debouncedStudentSearch, showInactiveStudents]);

  // Load chart data only when visible tabs need it
  useEffect(() => {
    if (!selectedCourseId || !needsChartData) {
      return;
    }

    fetchCharts(selectedCourseId, selectedGroupId);
  }, [selectedCourseId, selectedGroupId, needsChartData]);

  // Load quiz errors only when quizzes/topics/overview tabs are active
  useEffect(() => {
    if (selectedCourseId && selectedGroupId && needsQuizData) {
      fetchQuizErrors(selectedCourseId, selectedGroupId, lessonFilter);
    }
  }, [selectedCourseId, selectedGroupId, lessonFilter, needsQuizData]);

  useEffect(() => {
    if (selectedCourseId && needsQuizData && courseLessons.length === 0) {
      fetchCourseLessons(selectedCourseId);
    }
  }, [selectedCourseId, needsQuizData, courseLessons.length]);

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
      newParams.set('page', '1');
      setSearchParams(newParams);
  };

  const openGroupStudents = (groupId: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'students');
      newParams.set('group_id', groupId);
      newParams.set('page', '1');
      setSearchParams(newParams);
  };

  const handleTabChange = (tab: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', tab);
      setSearchParams(newParams);
      if (tab !== 'quizzes' && tab !== 'topics') {
        setLessonFilter('all');
      }
  };

  const handleSortChange = (field: 'name' | 'progress' | 'activity') => {
    const newParams = new URLSearchParams(searchParams);
    if (studentSort === field) {
        newParams.set('dir', studentSortDir === 'asc' ? 'desc' : 'asc');
    } else {
        newParams.set('sort', field);
        newParams.set('dir', 'desc');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (nextPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(nextPage));
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
        setError(t('teacherInsights.analytics.noCoursesToView'));
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      setError(t('teacherInsights.analytics.loadCoursesFailed'));
    }
  };

  const fetchCourseGroups = async (courseId: string, includeArchived = showArchivedGroups) => {
      setLoadingGroups(true);
      try {
          const groupsData = await apiClient.getCourseGroupsAnalytics(String(courseId), includeArchived);
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
        const data = await apiClient.getCourseAnalyticsOverview(courseId, {
          group_id: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          search: debouncedStudentSearch.trim() || undefined,
          include_inactive: showInactiveStudents || undefined,
          page: studentPage,
          page_size: studentPageSize,
          sort: studentSort,
          dir: studentSortDir
        });
        setOverview({
          total_students: data?.engagement?.total_enrolled_students || 0,
          active_students: data?.student_performance?.filter((student: any) => Boolean(student.last_activity)).length || 0,
          average_progress: data?.engagement?.average_completion_rate || 0,
          average_score: data?.student_performance?.length
            ? data.student_performance.reduce((sum: number, student: any) => sum + (student.assignment_score_percentage || 0), 0) / data.student_performance.length
            : 0,
          completion_rate: data?.engagement?.average_completion_rate || 0
        });
        const mappedStudents = (data.student_performance || []).map((s: any) => ({
          student_id: s.student_id,
          student_name: s.student_name,
          email: s.email || '',
          group_ids: s.group_ids || [],
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
        setStudentsPagination(data.pagination || null);
    } catch (err) {
        console.error("Failed to fetch overview", err);
        setError(t('teacherInsights.analytics.loadOverviewFailed'))
    } finally {
        setLoadingOverview(false);
    }
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
          const [videoData, progressData] = await Promise.all([
            apiClient.getVideoEngagementAnalytics(courseId),
            apiClient.getCourseProgressHistory(courseId, groupId)
          ]);

          setVideoMetrics(videoData.video_analytics || []);
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
  const sortedStudents = useMemo(() => students, [students]);

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return t('teacherInsights.time.never');
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return t('teacherInsights.time.minutesAgo', { minutes: diffMins });
    if (diffHours < 24) return t('teacherInsights.time.hoursAgo', { hours: diffHours });
    if (diffDays < 7) return t('teacherInsights.time.daysAgo', { days: diffDays });
    return formatDate(date);
  };

  const formatDuration = (minutes?: number) => {
      if (!minutes) return '-';
      if (minutes < 60) return t('teacherInsights.duration.minutes', { minutes: Math.round(minutes) });
      return t('teacherInsights.duration.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: Math.round(minutes % 60) });
  };

  const formatQuestionType = (type: string) => {
    switch (type) {
        case 'choice':
        case 'multiple_choice':
            return t('teacherInsights.analytics.questionType.multipleChoice');
        case 'multi_choice':
            return t('teacherInsights.analytics.questionType.multipleSelection');
        case 'fill_blank':
            return t('teacherInsights.analytics.questionType.fillBlank');
        case 'long_text':
            return t('teacherInsights.analytics.questionType.openEnded');
        default:
            return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
    }
  };


  if (!user || !['teacher', 'curator', 'admin', 'head_curator', 'head_teacher'].includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">{t('teacherInsights.analytics.accessDenied')}</h2>
            <p className="text-muted-foreground">{t('teacherInsights.analytics.noPermission')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (courses.length === 0 && !loadingOverview) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('teacherInsights.analytics.noCourses')}</h2>
        <p className="text-muted-foreground">{t('teacherInsights.analytics.noCourseAccess')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col @2xl:flex-row gap-4 items-start @2xl:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('analytics.title')}</h1>
          <p className="text-muted-foreground  mt-1">{t('analytics.subtitle')}</p>
        </div>
        
        <div className="flex flex-col @lg:flex-row gap-3 w-full @2xl:w-auto">
          <Select 
            value={selectedCourseId} 
             onValueChange={handleCourseChange}
          >
            <SelectTrigger className="w-full @lg:w-[280px] bg-card">
              <SelectValue placeholder={t('analytics.selectCourse')} />
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
<SelectTrigger className="w-full @lg:w-[200px] bg-card">
            <SelectValue placeholder={t('analytics.filterByGroup')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('analytics.allGroups')}</SelectItem>
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
           <strong className="font-bold">{t('teacherInsights.analytics.errorPrefix')} </strong>
           <span className="block @lg:inline">{error}</span>
        </div>
      )}

      {loadingOverview ? (
         <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-4">
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
        <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.stats.totalStudents')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.total_students}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('teacherInsights.analytics.activeRecently', { count: overview.active_students })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.stats.avgProgress')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.average_progress)}%</div>
              <Progress value={overview.average_progress} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.stats.avgScore')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.average_score)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('teacherInsights.analytics.assignmentPerformance')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.stats.completionRate')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overview.completion_rate)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('teacherInsights.analytics.courseCompletion')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="overview">{t('analytics.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="students">{t('analytics.tabs.students')}</TabsTrigger>
          <TabsTrigger value="groups">{t('analytics.tabs.groups')}</TabsTrigger>
          <TabsTrigger value="quizzes">{t('analytics.tabs.quizzes')}</TabsTrigger>
          <TabsTrigger value="topics">{t('analytics.tabs.topics')}</TabsTrigger>
          <TabsTrigger value="engagement">{t('analytics.tabs.engagement')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-7 items-start">
            <Card className="col-span-7 @4xl:col-span-4">
              <CardHeader>
                <CardTitle>{t('teacherInsights.analytics.progressOverTime')}</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                {selectedGroupId === 'all' ? (
                    <div className="h-[350px] flex items-center justify-center text-muted-foreground font-medium">
                        {t('teacherInsights.analytics.selectGroupFirst')}
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
                              <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => {
                                // Format date as "MMM dd" (e.g., Jan 15)
                                if (!value) return '';
                                const date = new Date(value);
                                return formatDate(date, { month: 'short', day: 'numeric' });
                            }}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value}%`} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                                background: 'hsl(var(--popover))', 
                                border: '1px solid hsl(var(--border))',
                                color: 'hsl(var(--popover-foreground))', 
                                borderRadius: '8px', 
                                boxShadow: 'var(--shadow-md)'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="progress" 
                            stroke="hsl(var(--brand))" 
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
            
            <Card className="col-span-7 @4xl:col-span-3">
              <CardHeader>
                <CardTitle>{t('teacherInsights.analytics.difficultLessons')}</CardTitle>
                <CardDescription>
                   {t('teacherInsights.analytics.difficultLessonsHint')}
                   <span className="block text-[10px] mt-1 text-muted-foreground italic">
                     {t('teacherInsights.analytics.difficultLessonsFormula')}
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
                    <div className="text-center py-8 text-muted-foreground">{t('teacherInsights.analytics.noData')}</div>
                ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {topicAnalysis.slice(0, 50).map((topic) => (
                        <div key={topic.id} className="flex items-center">
                            <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-semibold leading-tight text-foreground break-words" title={topic.title}>
                                    {topic.title}
                                </p>
                                <Badge variant={topic.errorRate > 70 ? "destructive" : "secondary"}>
                                    {t('teacherInsights.analytics.errorRateBadge', { rate: Math.round(topic.errorRate) })}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                {t('teacherInsights.analytics.questionsCount', { count: topic.questions })} • {t('teacherInsights.analytics.attemptsCount', { count: topic.attempts })}
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
            <CardHeader className="flex flex-col @lg:flex-row @lg:items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{t('teacherInsights.analytics.studentDirectory')}</CardTitle>
                <CardDescription>
                  {t('teacherInsights.analytics.studentDirectoryHint', { count: studentsPagination?.total_items ?? students.length })}
                </CardDescription>
              </div>
              <div className="flex flex-col items-stretch gap-2 w-full @lg:w-72">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={studentSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentSearch(e.target.value)}
                    placeholder={t('analytics.students.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground  cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInactiveStudents}
                    onChange={e => setShowInactiveStudents(e.target.checked)}
                    className="rounded border-border"
                  />
                  {t('analytics.students.includeDeactivated')}
                </label>
              </div>
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
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] cursor-pointer hover:bg-muted dark:hover:bg-secondary" onClick={() => handleSortChange('name')}>
                      {t('teacherInsights.analytics.col.student')} {studentSort === 'name' && <SortMark dir={studentSortDir} />}
                    </TableHead>
                    <TableHead className="text-center">{t('teacherInsights.analytics.col.group')}</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted dark:hover:bg-secondary" onClick={() => handleSortChange('progress')}>
                      {t('teacherInsights.analytics.col.progress')} {studentSort === 'progress' && <SortMark dir={studentSortDir} />}
                    </TableHead>
                    <TableHead>{t('teacherInsights.analytics.col.currentLesson')}</TableHead>
                    {courses.find(c => c.id.toString() === selectedCourseId)?.title.toLowerCase().includes('sat') ? (
                      <TableHead className="w-[120px]">{t('teacherInsights.analytics.col.weeklyTest')}</TableHead>
                    ) : (
                      <TableHead className="w-[180px]">{t('teacherInsights.analytics.col.lastTest')}</TableHead>
                    )}
                    <TableHead className="text-center">{t('teacherInsights.analytics.col.assignments')}</TableHead>
                    <TableHead className="text-center">{t('teacherInsights.analytics.col.timeSpent')}</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted dark:hover:bg-secondary" onClick={() => handleSortChange('activity')}>
                      {t('teacherInsights.analytics.col.lastActive')} {studentSort === 'activity' && <SortMark dir={studentSortDir} />}
                    </TableHead>
                    <TableHead className="text-right">{t('teacherInsights.analytics.col.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((student) => (
                    <TableRow 
                      key={student.student_id}
                      className="hover:bg-muted dark:hover:bg-secondary/50 cursor-pointer group py-0"
                      onClick={() => navigate(`/analytics/student/${student.student_id}?course_id=${selectedCourseId}`)}
                    >
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium text-foreground">
                            {student.student_name}
                            {student.is_inactive && (
                              <span className="ml-1.5 text-[10px] font-normal text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded px-1 py-px align-middle">{t('analytics.students.deactivated')}</span>
                            )}
                          </p>
                          <p className="text-muted-foreground">{student.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2 pr-0">
                        <Badge variant="outline" className="font-normal text-muted-foreground  text-xs px-2 py-0 h-6">
                            {groups.find(g => g.name === student.group_name)?.description || student.group_name || t('teacherInsights.analytics.noGroup')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={student.progress_percentage} className="h-2 w-16" />
                          <span className="text-sm font-medium text-foreground">{Math.round(student.progress_percentage)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                         <div className="flex flex-col gap-1 max-w-[200px]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground  truncate font-medium" title={student.current_lesson || t('teacherInsights.analytics.notStarted')}>
                                   {student.current_lesson || t('teacherInsights.analytics.notStarted')}
                                </span>
                            </div>
                            {student.current_lesson && student.current_lesson !== 'Not started' && (
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 bg-muted  rounded-full h-1.5">
                                        <div 
                                            className="bg-brand-solid h-1.5 rounded-full" 
                                            style={{ width: `${student.current_lesson_progress || 0}%` }}
                                        />
                                    </div>
                                    {(student.current_lesson_steps_total || 0) > 0 && (
                                        <span className="text-[10px] text-muted-foreground  font-medium whitespace-nowrap min-w-[30px] text-right">
                                            {student.current_lesson_steps_completed || 0}/{student.current_lesson_steps_total}
                                        </span>
                                    )}
                                </div>
                            )}
                         </div>
                      </TableCell>
                      {courses.find(c => c.id.toString() === selectedCourseId)?.title.toLowerCase().includes('sat') ? (
                          <TableCell className="py-2">
                             <div className="flex flex-col gap-0.5 text-xs text-foreground">
                                <div>
                                    <span className="font-medium text-muted-foreground  mr-1">{t('teacherInsights.shared.verbal')}:</span>
                                    {student.last_test_result?.verbal_score != null ?
                                        `${student.last_test_result.verbal_score}/${student.last_test_result.verbal_max || 0}`
                                        : '-'
                                    }
                                </div>
                                <div>
                                    <span className="font-medium text-muted-foreground  mr-2.5">{t('teacherInsights.shared.math')}:</span>
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
                                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]" title={student.last_test_result.title}>
                                      {student.last_test_result.title}
                                  </span>
                                  <span className={`text-xs font-bold ${
                                      student.last_test_result.percentage >= 80 ? 'text-green-600 dark:text-green-400' : 
                                      student.last_test_result.percentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                      {student.last_test_result.percentage}%
                                  </span>
                              </div>
                           ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                           )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                         <div className="text-sm">
                            <span className="font-medium">{student.completed_assignments || 0}</span>
                            <span className="text-muted-foreground">/{student.total_assignments || 0}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(student.time_spent_minutes)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatTimeAgo(student.last_activity)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="sm" className="h-8 px-2 text-brand">
                            {t('teacherInsights.analytics.details')}
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedStudents.length === 0 && (
                     <TableRow>
                         <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                             {t('teacherInsights.analytics.noStudentsMatch')}
                         </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
              {studentsPagination && studentsPagination.total_pages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('teacherInsights.analytics.pageOf', { page: studentsPagination.page, total: studentsPagination.total_pages })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={studentsPagination.page <= 1 || loadingOverview}
                      onClick={() => handlePageChange(studentsPagination.page - 1)}
                    >
                      {t('teacherInsights.analytics.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={studentsPagination.page >= studentsPagination.total_pages || loadingOverview}
                      onClick={() => handlePageChange(studentsPagination.page + 1)}
                    >
                      {t('teacherInsights.analytics.next')}
                    </Button>
                  </div>
                </div>
              )}
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
           {loadingGroups ? <Skeleton className="h-[200px] w-full" /> : (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>{t('teacherInsights.analytics.courseGroups')}</CardTitle>
                  <CardDescription>{t('teacherInsights.analytics.courseGroupsHint')}</CardDescription>
                </div>
                <div className="flex flex-col @lg:flex-row items-stretch @lg:items-center gap-3">
                  <div className="relative w-full @lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={groupSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupSearch(e.target.value)}
                      placeholder={t('analytics.groups.searchPlaceholder')}
                      className="pl-9"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground  cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showArchivedGroups}
                      onChange={e => setShowArchivedGroups(e.target.checked)}
                      className="rounded border-border"
                    />
                    {t('analytics.groups.showArchived')}
                  </label>
                </div>
              </CardHeader>
              <CardContent>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>{t('teacherInsights.analytics.col.groupName')}</TableHead>
                     <TableHead>{t('teacherInsights.analytics.col.students')}</TableHead>
                     <TableHead>{t('teacherInsights.analytics.col.avgCompletion')}</TableHead>
                     <TableHead>{t('teacherInsights.analytics.col.avgScore')}</TableHead>
                     <TableHead className="text-right">{t('teacherInsights.analytics.col.actions')}</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                  {groupsAnalytics.filter(g => {
                    const needle = groupSearch.trim().toLowerCase();
                    if (!needle) return true;
                    return (g.group_name || '').toLowerCase().includes(needle)
                      || (g.description || '').toLowerCase().includes(needle)
                      || (g.teacher_name || '').toLowerCase().includes(needle)
                      || (g.curator_name || '').toLowerCase().includes(needle);
                  }).map(group => (
                    <TableRow key={group.group_id}>
                      <TableCell className="font-medium">
                        {group.description || group.group_name}
                        {group.is_archived && (
                          <Badge variant="outline" className="ml-2 text-xs text-muted-foreground border-border">{t('analytics.groups.archived')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                            <span>{group.students_count}</span>
                            <span className="text-muted-foreground text-xs">{t('teacherInsights.analytics.studentsWord', { count: group.students_count })}</span>
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
                            className="text-brand hover:text-brand"
                            onClick={() => openGroupStudents(String(group.group_id))}
                         >
                            {t('teacherInsights.analytics.viewStudents')}
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {groupsAnalytics.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {t('teacherInsights.analytics.noGroups')}
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
            <div className="flex flex-col @2xl:flex-row gap-4 items-end justify-between bg-card p-4 rounded-xl border border-border">
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4 w-full @2xl:w-auto flex-1">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider flex items-center gap-1.5">
                            <Search className="h-3 w-3" />
                            {t('teacherInsights.analytics.searchQuestions')}
                        </label>
                        <input 
                            type="text"
                            placeholder={t('teacherInsights.analytics.searchByKeyword')}
                            className="w-full px-3 py-2 bg-card border border-border dark:text-foreground dark:placeholder:text-muted-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all font-medium"
                            value={quizSearch}
                            onChange={(e) => setQuizSearch(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider flex items-center gap-1.5">
                            <Filter className="h-3 w-3" />
                            {t('teacherInsights.analytics.filterByLesson')}
                        </label>
                        <Select value={lessonFilter} onValueChange={setLessonFilter}>
                            <SelectTrigger className="w-full bg-card border-border">
                                <SelectValue placeholder={t('teacherInsights.shared.allLessons')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('teacherInsights.analytics.allLessonsCount', { count: courseLessons.length })}</SelectItem>
                                {courseLessons.map(lesson => (
                                    <SelectItem key={lesson.id} value={lesson.id}>{lesson.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="h-9 px-3 font-medium bg-brand-surface  text-brand-subtle-foreground  border-brand-border">
                        {t('teacherInsights.analytics.questionsAnalyzed', { count: filteredQuizErrors.length })}
                    </Badge>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-card border-b border-border py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div>
                                <CardTitle className="text-lg font-bold text-foreground">{t('teacherInsights.analytics.difficultQuestions')}</CardTitle>
                                <CardDescription>{t('teacherInsights.analytics.difficultQuestionsHint')}</CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-transparent hover:bg-transparent border-b">
                                    <TableHead className="w-[35%] py-4 text-xs font-medium text-muted-foreground">{t('teacherInsights.analytics.col.question')}</TableHead>
                                    <TableHead className="w-[15%] py-4 text-xs font-medium text-muted-foreground">{t('teacherInsights.analytics.col.type')}</TableHead>
                                    <TableHead className="w-[20%] py-4 text-xs font-medium text-muted-foreground">{t('teacherInsights.analytics.col.context')}</TableHead>
                                    <TableHead className="w-[10%] py-4 text-center text-xs font-medium text-muted-foreground">{t('teacherInsights.analytics.col.attempts')}</TableHead>
                                    <TableHead className="w-[10%] py-4 text-center text-xs font-medium text-muted-foreground">{t('teacherInsights.analytics.col.error')}</TableHead>
                                    <TableHead className="w-[10%] py-4 text-right text-xs font-medium text-muted-foreground"></TableHead>
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
                                        <TableRow key={`${error.step_id}-${error.question_id}-${idx}`} className="group hover:bg-brand-subtle/50 transition-colors border-b border-border/50 dark:border-border">
                                            <TableCell className="py-5">
                                                <div className="max-w-md">
                                                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2" title={error.question_text}>
                                                        {error.question_text || t('teacherInsights.analytics.untitledQuestion')}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider bg-muted dark:bg-secondary border-border text-muted-foreground whitespace-nowrap">
                                                    {formatQuestionType(error.question_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <p className="text-xs text-muted-foreground  truncate max-w-[220px]">
                                                    {error.lesson_title} <span className="text-muted-foreground/50/50 mx-1">•</span> {error.step_title}
                                                </p>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <span className="text-sm text-muted-foreground">{error.total_attempts}</span>
                                            </TableCell>
                                            <TableCell className="py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`text-sm font-bold ${
                                                        error.error_rate > 60 ? 'text-red-600 dark:text-red-400' : 
                                                        error.error_rate > 30 ? 'text-amber-600 dark:text-amber-400' : 
                                                        error.error_rate > 0 ? 'text-brand' : 'text-green-600 dark:text-green-400'
                                                    }`}>
                                                        {Number(error.error_rate).toFixed(1)}%
                                                    </span>
                                                    <div className="w-12 h-1 bg-muted  rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                error.error_rate > 60 ? 'bg-red-500' : 
                                                                error.error_rate > 30 ? 'bg-amber-500' : 
                                                                error.error_rate > 0 ? 'bg-brand-solid' : 'bg-green-500'
                                                            }`}
                                                            style={{ width: `${Math.max(error.error_rate, 2)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <Link 
                                                    to={`/course/${selectedCourseId}/lesson/${error.lesson_id}?stepId=${error.step_id}&questionId=${error.question_id}`}
                                                    className="inline-flex items-center text-sm text-brand hover:text-brand font-medium gap-1 group/btn pr-2"
                                                >
                                                    {t('teacherInsights.analytics.view')}
                                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="p-4 bg-muted dark:bg-secondary rounded-full">
                                                    <XAxis className="h-8 w-8 text-muted-foreground/50/50" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-lg font-semibold text-foreground">{t('teacherInsights.analytics.noDifficultQuestions')}</p>
                                                    <p className="text-sm text-muted-foreground">{t('teacherInsights.analytics.adjustFilters')}</p>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => { setQuizSearch(''); setLessonFilter('all'); }}
                                                >
                                                    {t('teacherInsights.analytics.clearFilters')}
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
                <h3 className="text-lg font-medium">{t('teacherInsights.analytics.problematicTopics')}</h3>
                <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
                  {topicAnalysis.map((topic, i) => (
                    <Card key={i}>
                      <CardHeader>
                         <CardTitle className="text-base">{topic.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">{t('teacherInsights.analytics.errorRate')}</span>
                            <Badge variant={topic.errorRate > 50 ? "destructive" : "secondary"}>{Math.round(topic.errorRate)}%</Badge>
                         </div>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">{t('teacherInsights.analytics.totalErrors')}</span>
                            <span className="font-medium text-red-600 dark:text-red-400">{topic.errors}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('teacherInsights.analytics.questions')}</span>
                            <span className="font-medium">{topic.questions}</span>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                  {topicAnalysis.length === 0 && (
                      <div className="col-span-3 text-center py-8 text-muted-foreground">{t('teacherInsights.analytics.noTopicAnalysis')}</div>
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
                                 <p className="text-sm text-muted-foreground">{video.step_title}</p>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold">{t('teacherInsights.analytics.views', { count: video.total_views })}</div>
                                 <div className="text-xs text-muted-foreground">{t('teacherInsights.analytics.minsAvg', { minutes: Math.round(video.average_watch_time_minutes) })}</div>
                             </div>
                         </div>
                     ))}
                     {videoMetrics.length === 0 && <div className="text-center py-8 text-muted-foreground">{t('teacherInsights.analytics.noVideoData')}</div>}
                 </div>
             )}
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
