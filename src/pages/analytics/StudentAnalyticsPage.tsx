import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle2, Circle, ChevronDown, BookOpen, AlertTriangle, History, TrendingUp, Search, FileText } from 'lucide-react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import apiClient from '@/services/api';

interface StepProgress {
  status: 'completed' | 'in_progress' | 'not_started';
  started_at: string | null;
  visited_at: string | null;
  completed_at: string | null;
  time_spent_minutes: number;
  attempts: number;
}

interface StepInfo {
  step_id: number;
  step_title: string;
  step_order: number;
  content_type: string;
  progress: StepProgress;
}

interface LessonData {
  lesson_info: {
    id: number;
    title: string;
    order_index: number;
  };
  steps: StepInfo[];
}

interface ModuleData {
  module_info: {
    id: number;
    title: string;
    order_index: number;
  };
  lessons: Record<string, LessonData>;
}

interface CourseProgress {
  course_info: {
    id: number;
    title: string;
    description: string;
  };
  modules: Record<string, ModuleData>;
}

interface DifficultTopic {
  id: number;
  title: string;
  error_count: number;
}

interface DifficultQuestion {
  id: string;
  text: string;
  type: string;
  lesson_id: number;
  lesson_title: string;
  step_id: number;
}

interface HomeworkItem {
  id: number;
  title: string;
  due_date: string | null;
  status: 'submitted' | 'pending';
  score: number | null;
  max_score: number;
  submitted_at: string | null;
  is_graded: boolean;
}

interface ActivityEvent {
  type: 'step_visited' | 'step_completed' | 'quiz_attempt' | 'assignment_submitted';
  title: string;
  context: string;
  timestamp: string;
  date: string;
}

interface DetailedProgress {
  courses: Record<string, CourseProgress>;
  student_info: {
    id: number;
    name: string;
    email: string;
  };
  total_stats: {
    total_steps: number;
    completed_steps: number;
    total_study_time: number;
    last_activity: string | null;
  };
  difficult_topics: DifficultTopic[];
  difficult_questions: DifficultQuestion[];
  activity_history: ActivityEvent[];
  homework: HomeworkItem[];
}

export const StudentAnalyticsPage: React.FC = () => {
  const { studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isTeacher, isCurator, isAdmin } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const courseId = searchParams.get('course_id');
  const activeTab = searchParams.get('tab') || 'performance';

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', value);
    setSearchParams(newParams);
  };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailedProgress | null>(null);
  const [satData, setSatData] = useState<any[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [studentId, courseId]);

  const loadData = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const response = await apiClient.getStudentDetailedProgress(studentId, courseId || undefined);
      setData(response);
      
      // Fetch SAT scores
      try {
        const satResponse = await apiClient.getStudentSatScores(studentId);
        if (satResponse && satResponse.testResults) {
            const processed = satResponse.testResults
                .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()) // Desk sorted for table (Newest first)
                .map((t: any) => {
                    // Use backend-calculated percentages if available, otherwise calculate from questions
                    let mathPerc = t.math_pct;
                    let verbalPerc = t.verbal_pct;
                    
                    if (mathPerc === undefined || verbalPerc === undefined) {
                        const mathQuestions = t.questions?.filter((q: any) => q.questionType === 'Math') || [];
                        const verbalQuestions = t.questions?.filter((q: any) => q.questionType === 'Verbal') || [];
                        
                        const mathCorrect = mathQuestions.filter((q: any) => q.isCorrect).length;
                        const verbalCorrect = verbalQuestions.filter((q: any) => q.isCorrect).length;
                        
                        mathPerc = mathQuestions.length > 0 ? (mathCorrect / mathQuestions.length) * 100 : 0;
                        verbalPerc = verbalQuestions.length > 0 ? (verbalCorrect / verbalQuestions.length) * 100 : 0;
                    }
                    
                    return {
                        date: new Date(t.completedAt).toLocaleDateString(),
                        timestamp: new Date(t.completedAt).getTime(),
                        score: t.score,
                        percentage: t.percentage,
                        mathPercentage: Math.round(mathPerc),
                        verbalPercentage: Math.round(verbalPerc),
                        mathScore: t.math_score,
                        mathTotal: t.math_total,
                        verbalScore: t.verbal_score,
                        verbalTotal: t.verbal_total,
                        testName: t.testName,
                        fullDate: new Date(t.completedAt).toLocaleString()
                    };
                });
            setSatData(processed);
        }
      } catch (e) {
        console.warn("Could not fetch SAT scores", e);
      }
    } catch (err) {
      console.error('Failed to load student details:', err);
      setError('Failed to load student detailed progress.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading student details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analytics
          </Button>
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-md border border-red-200 dark:border-red-800">
            {error || "Student not found or no access."}
          </div>
        </div>
      </div>
    );
  }

  // Helper to sort and map records
  const getSortedModules = (courseData: CourseProgress) => {
    return Object.values(courseData.modules).sort((a, b) => a.module_info.order_index - b.module_info.order_index);
  };

  const getSortedLessons = (moduleData: ModuleData) => {
    // Sort lessons by id usually, or explicit order if available.
    // Assuming backend sorts map or we rely on ID.
    // In backend code, lessons dict key is lesson.id. 
    // We should rely on IDs or titles if no explicit order. 
    // Wait, backend response had order_index in module_info and lesson_info!
    return Object.values(moduleData.lessons).sort((a, b) => (a.lesson_info.order_index || 0) - (b.lesson_info.order_index || 0));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit pl-0 mb-2 hover:bg-slate-100 dark:hover:bg-secondary -ml-2 text-slate-600 dark:text-gray-400">
          <ArrowLeft className="mr-2 h-4 w-4" /> {isCurator() ? 'Назад к аналитике' : 'Back to Course Analytics'}
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">{data.student_info?.name || (isCurator() ? 'Детали студента' : 'Student Details')}</h1>
            <p className="text-slate-500 dark:text-gray-400">{data.student_info?.email}</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-gray-400">{isCurator() ? 'Общее время обучения' : 'Total Study Time'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatDuration(data.total_stats?.total_study_time || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-gray-400">{isCurator() ? 'Прогресс' : 'Progress'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.total_stats?.completed_steps} <span className="text-sm text-slate-400 dark:text-gray-500 font-normal">/ {data.total_stats?.total_steps} steps</span>
            </div>
            {data.total_stats?.total_steps > 0 && (
              <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full" 
                  style={{ width: `${(data.total_stats.completed_steps / data.total_stats.total_steps) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-gray-400">{isCurator() ? 'Последняя активность' : 'Last Activity'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{formatDate(data.total_stats?.last_activity)}</div>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Most recent action</p>
          </CardContent>
        </Card>
        <Card>
           <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-gray-400">{isCurator() ? 'Статус зачисления' : 'Enrollment Status'}</CardTitle>
          </CardHeader>
          <CardContent>
             <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">Active</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 max-w-xl">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> {isCurator() ? 'Успеваемость' : 'Performance'}
          </TabsTrigger>
          <TabsTrigger value="curriculum" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> {isCurator() ? 'Учебный план' : 'Curriculum'}
          </TabsTrigger>
          <TabsTrigger value="homework" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> {isCurator() ? 'Домашние задания' : 'Homework'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <History className="h-4 w-4" /> {isCurator() ? 'История' : 'History'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            {/* Left Column: Difficult Areas (Wider) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-slate-200 dark:border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Difficult Topics</CardTitle>
                  <CardDescription>Lessons with most mistakes</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.difficult_topics?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.difficult_topics.map((topic) => (
                        <Badge key={topic.id} variant="secondary" className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-default">
                          {topic.title}
                          <span className="ml-2 font-bold px-1.5 py-0.5 bg-amber-200/50 dark:bg-amber-800/50 rounded text-[10px]">{topic.error_count} errors</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 dark:text-gray-500 bg-slate-50 dark:bg-secondary border border-dashed dark:border-border rounded-lg">
                      No significant difficulty hotspots identified yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-border shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Difficult Questions</CardTitle>
                    <CardDescription>Specific questions that need review</CardDescription>
                  </div>
                  {data?.difficult_questions?.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                          <SelectValue placeholder="All Lessons" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Lessons</SelectItem>
                          {Array.from(new Map(data.difficult_questions.map(q => [q.lesson_id, q.lesson_title])).entries()).map(([id, title]) => (
                            <SelectItem key={id} value={id.toString()}>{title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative w-48">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 dark:text-gray-500" />
                        <Input
                          placeholder="Search..."
                          className="pl-8 h-9 text-xs"
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                    const filtered = data?.difficult_questions?.filter(q => {
                      const matchesSearch = q.text.toLowerCase().includes(questionSearch.toLowerCase()) ||
                                           q.lesson_title.toLowerCase().includes(questionSearch.toLowerCase());
                      const matchesLesson = selectedLessonId === 'all' || q.lesson_id.toString() === selectedLessonId;
                      return matchesSearch && matchesLesson;
                    }) || [];
                    
                    return filtered.length > 0 ? (
                      <div className="space-y-3">
                        {filtered.map((q) => (
                        <div key={q.id} className="group flex items-start justify-between p-3 rounded-lg border border-slate-100 dark:border-border hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-foreground line-clamp-1">{q.text}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-secondary rounded border border-slate-200 dark:border-border">{q.type.replace('_', ' ')}</span>
                              <span>•</span>
                              <span>{q.lesson_title}</span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-white dark:hover:bg-card border-transparent hover:border-blue-100 dark:hover:border-blue-800 shadow-none transition-all"
                            onClick={() => navigate(`/course/${courseId}/lesson/${q.lesson_id}?stepId=${q.step_id}&questionId=${q.id}`)}
                          >
                            Inspect
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                      <div className="text-center py-6 text-slate-400 dark:text-gray-500 bg-slate-50 dark:bg-secondary border border-dashed dark:border-border rounded-lg">
                        {questionSearch ? "No questions match your filter." : "Congratulations! All answered questions look good."}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: SAT Stats (Narrower) */}
            <div className="lg:col-span-1 space-y-6">
              {satData.length > 0 && (
                <Card className="border-slate-200 dark:border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">SAT Dynamics</CardTitle>
                    <CardDescription>Score history</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...satData].reverse()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f1f5f9'} />
                          <XAxis dataKey="date" hide />
                          <YAxis domain={[0, 100]} hide />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: isDark ? 'hsl(220 6% 12%)' : 'white',
                              borderRadius: '8px',
                              border: isDark ? '1px solid hsl(220 6% 20%)' : '1px solid #e2e8f0',
                              color: isDark ? '#f3f4f6' : undefined,
                            }}
                            formatter={(value: any, name: string) => {
                                const labels: Record<string, string> = {
                                    percentage: 'Total',
                                    mathPercentage: 'Math',
                                    verbalPercentage: 'Verbal'
                                };
                                return [`${value}%`, labels[name] || name];
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="#2563eb" 
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: isDark ? '#1f2937' : '#fff' }}
                            name="percentage"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="mathPercentage" 
                            stroke="#ef4444" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3, fill: "#ef4444" }}
                            name="mathPercentage"
                            connectNulls
                          />
                          <Line 
                            type="monotone" 
                            dataKey="verbalPercentage" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3, fill: "#10b981" }}
                            name="verbalPercentage"
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-md border border-slate-100 dark:border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 dark:bg-secondary/50">
                            <TableHead className="text-[10px] uppercase font-bold py-2 px-2">TEST</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-bold py-2 px-1">MATH</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-bold py-2 px-1">VERBAL</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-bold py-2 px-2">TOTAL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {satData.slice(0, 10).map((test, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-secondary/50">
                              <TableCell className="py-2 px-2">
                                <p className="text-[11px] font-medium truncate max-w-[80px] text-foreground" title={test.testName}>{test.testName}</p>
                                <p className="text-[9px] text-slate-400 dark:text-gray-500">{test.date}</p>
                              </TableCell>
                              <TableCell className="text-center py-2 px-1">
                                {test.mathPercentage > 0 ? (
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-gray-300">{test.mathPercentage}%</span>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-gray-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-2 px-1">
                                {test.verbalPercentage > 0 ? (
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-gray-300">{test.verbalPercentage}%</span>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-gray-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-2 px-2">
                                <div className="flex flex-col items-center leading-tight">
                                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{test.percentage}%</span>
                                  {test.score > 0 && (
                                    <span className="text-[8px] text-slate-400 dark:text-gray-500 font-medium">{test.score}</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="homework">
          <div className="space-y-8">
            {/* Pending Homework */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground uppercase tracking-wider">Pending Assignments</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Upcoming work that needs submission</p>
                </div>
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800 font-medium">
                  {data?.homework?.filter(h => h.status === 'pending').length || 0}
                </Badge>
              </div>
              
              <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-lg overflow-hidden shadow-sm">
                {data?.homework?.filter(h => h.status === 'pending').length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-border">
                    {data.homework.filter(h => h.status === 'pending').map((hw) => {
                      const isOverdue = hw.due_date && new Date(hw.due_date) < new Date();
                      return (
                        <div key={hw.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-secondary/50 transition-colors flex items-center justify-between group">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 p-1.5 rounded group-hover:transition-colors ${isOverdue ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50'}`}>
                              <Clock className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-slate-900 dark:text-foreground">{hw.title}</h4>
                                {isOverdue && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-none">Overdue</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-rose-500 dark:text-rose-400 font-medium' : 'text-slate-500 dark:text-gray-400'}`}>
                                  <AlertTriangle className="h-3 w-3" />
                                  {hw.due_date ? `Due: ${new Date(hw.due_date).toLocaleDateString()}` : 'No deadline'}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {hw.max_score} pts
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs text-blue-600 dark:text-blue-400 hover:bg-white dark:hover:bg-secondary hover:text-blue-700 dark:hover:text-blue-300 border-transparent hover:border-slate-200 dark:hover:border-border shadow-none"
                            onClick={() => navigate(`/homework/${hw.id}/progress`)}
                          >
                            {isTeacher() ? 'Grade' : 'View Details'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 dark:text-gray-500">
                    <p className="text-sm font-medium">All tasks completed</p>
                    <p className="text-[11px]">No assignments currently pending.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Submitted Homework */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground uppercase tracking-wider">Submitted Work</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">History of your completed assignments</p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 font-medium">
                  {data?.homework?.filter(h => h.status === 'submitted').length || 0}
                </Badge>
              </div>
              
              <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-lg overflow-hidden shadow-sm">
                {data?.homework?.filter(h => h.status === 'submitted').length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-border">
                    {data.homework.filter(h => h.status === 'submitted').map((hw) => {
                      const needsGrading = !hw.is_graded;
                      return (
                        <div key={hw.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-secondary/50 transition-colors flex items-center justify-between group">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 p-1.5 rounded ${needsGrading ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400'}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-slate-900 dark:text-foreground">{hw.title}</h4>
                                {needsGrading && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-none">Needs Grading</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                                  <History className="h-3 w-3" />
                                  Submitted: {hw.submitted_at ? new Date(hw.submitted_at).toLocaleDateString() : 'Unknown'}
                                </span>
                                {hw.is_graded ? (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-none">Graded</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-secondary text-slate-500 dark:text-gray-400 border-none">Reviewing</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className={`text-sm font-bold ${needsGrading ? 'text-slate-400 dark:text-gray-500' : 'text-slate-900 dark:text-foreground'}`}>
                                {hw.is_graded ? `${hw.score} / ${hw.max_score}` : `-- / ${hw.max_score}`}
                              </div>
                              {hw.is_graded && hw.max_score > 0 && (
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">
                                  {Math.round((hw.score || 0) / hw.max_score * 100)}%
                                </div>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs text-blue-600 dark:text-blue-400 hover:bg-white dark:hover:bg-secondary hover:text-blue-700 dark:hover:text-blue-300 border-transparent hover:border-slate-200 dark:hover:border-border shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => navigate(`/homework/${hw.id}/progress`)}
                            >
                              {(isTeacher() || isCurator() || isAdmin()) ? (needsGrading ? 'Grade' : 'Review') : 'View Details'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 dark:text-gray-500">
                    <p className="text-sm font-medium">No submissions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="curriculum">
          {/* Detailed Curriculum Progress */}
          <Card className="border-slate-200 dark:border-border shadow-sm">
            <CardHeader>
              <CardTitle>Detailed Progress</CardTitle>
              <CardDescription>Step-by-step breakdown of learning activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] overflow-y-auto pr-4">
                {Object.values(data.courses || {}).map((course) => (
                  <div key={course.course_info.id} className="mb-8">
                    {(!courseId) && <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-foreground">{course.course_info.title}</h3>}
                    
                    <div className="space-y-4">
                      {getSortedModules(course).map((module) => (
                        <div key={module.module_info.id} className="border border-slate-200 dark:border-border rounded-md overflow-hidden">
                          <details className="group">
                            <summary className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 dark:bg-secondary hover:bg-slate-100 dark:hover:bg-muted transition-colors list-none">
                                <div className="flex items-center">
                                    <span className="font-semibold text-slate-700 dark:text-gray-300">Module {module.module_info.order_index}: {module.module_info.title}</span>
                                </div>
                                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-gray-400 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="p-4 bg-white dark:bg-card border-t border-slate-200 dark:border-border">
                                <div className="space-y-6">
                                  {getSortedLessons(module).map((lesson) => (
                                    <div key={lesson.lesson_info.id} className="bg-slate-50/50 dark:bg-secondary/50 rounded-lg p-4 border border-slate-100 dark:border-border">
                                        <h4 className="font-medium text-slate-900 dark:text-foreground mb-4 flex items-center">
                                            <BookOpen className="h-4 w-4 mr-2 text-slate-400 dark:text-gray-500"/>
                                            {lesson.lesson_info.title}
                                        </h4>
                                        <div className="space-y-1 pl-2 md:pl-6">
                                            {lesson.steps.sort((a,b) => a.step_order - b.step_order).map((step) => (
                                                <div key={step.step_id} className="group/step flex md:items-center justify-between text-sm py-3 border-b border-slate-100 dark:border-border last:border-0 hover:bg-white dark:hover:bg-card hover:shadow-sm px-3 rounded-md transition-all">
                                                    <div className="flex md:items-center gap-3">
                                                        <div className="mt-0.5 md:mt-0">
                                                            {step.progress.status === 'completed' ? (
                                                                <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0" />
                                                            ) : step.progress.status === 'in_progress' ? (
                                                                <Circle className="h-5 w-5 text-blue-500 dark:text-blue-400 fill-blue-50 dark:fill-blue-900/30 flex-shrink-0" />
                                                            ) : (
                                                                <Circle className="h-5 w-5 text-slate-300 dark:text-gray-600 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                                            <span className={step.progress.status === 'completed' ? 'text-slate-700 dark:text-gray-300 font-medium' : 'text-slate-500 dark:text-gray-400'}>
                                                                {step.step_title}
                                                            </span>
                                                            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 px-1.5 py-0.5 border rounded border-slate-200 dark:border-border w-fit">{step.content_type.replace('_', ' ')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-6 text-xs text-slate-400 dark:text-gray-500 flex-shrink-0 ml-4">
                                                        {step.progress.time_spent_minutes > 0 && (
                                                            <span className="flex items-center text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-secondary px-2 py-1 rounded-full">
                                                                <Clock className="h-3 w-3 mr-1" />
                                                                {formatDuration(step.progress.time_spent_minutes)}
                                                            </span>
                                                        )}
                                                        {step.progress.completed_at && (
                                                            <span className="hidden md:inline">{new Date(step.progress.completed_at).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                  ))}
                                </div>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                    {/* Fallback if no modules */}
                    {getSortedModules(course).length === 0 && (
                        <div className="text-center py-8 text-slate-400 dark:text-gray-500">No content structure found for this course.</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          {/* Activity Timeline */}
          <Card className="border-slate-200 dark:border-border shadow-sm flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                History of Activity
              </CardTitle>
              <CardDescription>Recent learning actions</CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto px-10 pb-10">
              {data.activity_history?.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-100 dark:border-border space-y-8">
                  {data.activity_history.map((event, idx) => (
                    <div key={idx} className="relative">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-card ${
                        event.type === 'step_completed' ? 'bg-green-500' : 
                        event.type === 'quiz_attempt' ? 'bg-amber-500' : 'bg-blue-400'
                      }`} />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-semibold text-slate-800 dark:text-foreground leading-none">{event.title}</p>
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 whitespace-nowrap bg-slate-50 dark:bg-secondary px-2 py-0.5 rounded border border-slate-100 dark:border-border">
                             {new Date(event.timestamp).toLocaleDateString()} {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{event.context}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-400 dark:text-gray-500 italic">
                    No activity recorded recently.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
