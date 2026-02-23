import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import type { DashboardStats, StudentProgressOverview, Assignment, Event, AssignmentSubmission } from "../types";
import { Clock, BookOpen, LineChart, CheckCircle, Target, Calendar, FileText, AlertCircle, Video, GraduationCap, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/api";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import StudentLeaderboard from '../components/StudentLeaderboard';
import DailyQuestionsPopup from '../components/DailyQuestionsPopup';

interface StudentDashboardProps {
  firstName: string;
  stats: DashboardStats;
  onContinueCourse: (id: string) => void;
  onGoToAllCourses: () => void;
}

export default function StudentDashboard({
  firstName,
  stats,
  onContinueCourse,
  onGoToAllCourses,
}: StudentDashboardProps) {
  const navigate = useNavigate();
  const [progressData, setProgressData] = useState<StudentProgressOverview | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  
  // Todo list state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoadingTodo, setIsLoadingTodo] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Daily questions state
  const [dailyQuestionsCompleted, setDailyQuestionsCompleted] = useState(false);
  const [dailyQuestionsScore, setDailyQuestionsScore] = useState<{ score: number; total: number } | null>(null);
  const [showDailyQuestions, setShowDailyQuestions] = useState(false);

  useEffect(() => {
    loadProgressData();
    loadTodoData();
    loadDailyQuestionsStatus();
  }, []);

  const loadProgressData = async () => {
    try {
      setIsLoadingProgress(true);
      const data = await apiClient.getStudentProgressOverview();
      setProgressData(data);
    } catch (error) {
      console.error('Failed to load progress data:', error);
      // Fallback: try to load basic course list if progress overview fails
      try {
        const basicCourses = await apiClient.getMyCourses();
        if (basicCourses.length > 0) {
          // Create minimal progress data structure from basic courses
          const fallbackData: StudentProgressOverview = {
            student_id: 0, // Will be filled by backend
            student_name: '', // Will be filled by backend
            total_courses: basicCourses.length,
            total_lessons: 0,
            total_steps: 0,
            completed_lessons: 0,
            completed_steps: 0,
            overall_completion_percentage: 0,
            total_time_spent_minutes: 0,
            courses: basicCourses.map(course => ({
              course_id: parseInt(course.id.toString()),
              course_title: course.title,
              teacher_id: parseInt(course.teacher_id?.toString() || '0'),
              teacher_name: course.teacher_name || 'Unknown',
              cover_image_url: course.cover_image_url,
              completion_percentage: 0,
              total_lessons: 0,
              completed_lessons: 0,
              total_steps: 0,
              completed_steps: 0,
              time_spent_minutes: 0
            }))
          };
          setProgressData(fallbackData);
        }
      } catch (fallbackError) {
        console.error('Fallback course loading also failed:', fallbackError);
      }
    } finally {
      setIsLoadingProgress(false);
    }
  };

  const loadDailyQuestionsStatus = async () => {
    try {
      const status = await apiClient.getDailyQuestionsStatus();
      setDailyQuestionsCompleted(status.completed_today);
      if (status.score != null && status.total_questions != null) {
        setDailyQuestionsScore({ score: status.score, total: status.total_questions });
      }
    } catch (error) {
      console.error('Failed to load daily questions status:', error);
    }
  };

  const loadTodoData = async () => {
    try {
      setIsLoadingTodo(true);
      
      // Load assignments, events, and submissions in parallel
      const [assignmentsData, eventsData, submissionsData] = await Promise.all([
        apiClient.getAssignments({ is_active: true }),
        apiClient.getMyEvents({ upcoming_only: true, limit: 10 }),
        apiClient.getMySubmissions()
      ]);
      
      setAssignments(assignmentsData || []);
      setEvents(eventsData || []);
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Failed to load todo data:', error);
    } finally {
      setIsLoadingTodo(false);
    }
  };


  const coursesCount = progressData?.total_courses ?? stats?.courses_count ?? 0;
  const totalStudyHours = progressData 
    ? Math.round((progressData.total_time_spent_minutes / 60) * 10) / 10
    : Math.round(((stats?.total_study_time ?? 0) / 60) * 10) / 10;
  const overallProgress = progressData?.overall_completion_percentage ?? stats?.overall_progress ?? 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Helper functions for todo list
  const getAssignmentStatus = (assignment: Assignment) => {
    const submission = submissions.find(sub => sub.assignment_id === assignment.id);
    if (submission) {
      if (submission.is_graded) {
        return { status: 'graded', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle };
      } else {
        return { status: 'submitted', color: 'bg-blue-100 text-blue-800', icon: FileText };
      }
    }
    
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    
    if (dueDate && dueDate < now) {
      return { status: 'overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle };
    } else if (dueDate && (dueDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) {
      return { status: 'due_soon', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    } else {
      return { status: 'pending', color: 'bg-gray-100 text-gray-800', icon: FileText };
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'class': return GraduationCap;
      case 'webinar': return Video;
      case 'weekly_test': return FileText;
      default: return Calendar;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'class': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'webinar': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'weekly_test': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Get current and relevant assignments (due soon, overdue, or recent)
  const relevantAssignments = assignments
    .filter(assignment => {
      const submission = submissions.find(sub => sub.assignment_id === assignment.id);
      if (!showCompleted && submission?.is_graded) return false;

      if (!assignment.due_date) return false;
      const dueDate = new Date(assignment.due_date);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // If showing completed, include all assignments
      if (showCompleted) {
        // Show assignments due within 3 days or recent assignments
        if (dueDate <= threeDaysFromNow) return true;
        const createdDate = new Date(assignment.created_at);
        if (createdDate >= sevenDaysAgo) return true;
        return false;
      }
      
      // Show overdue assignments (not submitted yet)
      if (dueDate < now && !submission) return true;
      
      // Show assignments due within 3 days
      if (dueDate <= threeDaysFromNow) return true;
      
      // Show recent assignments (created in last 7 days)
      const createdDate = new Date(assignment.created_at);
      if (createdDate >= sevenDaysAgo) return true;
      
      return false;
    })
    .sort((a, b) => {
      if (!a.due_date || !b.due_date) return 0;
      const aDate = new Date(a.due_date);
      const bDate = new Date(b.due_date);
      const now = new Date();
      
      // Prioritize overdue assignments (not submitted)
      const aSubmission = submissions.find(sub => sub.assignment_id === a.id);
      const bSubmission = submissions.find(sub => sub.assignment_id === b.id);
      const aOverdue = aDate < now && !aSubmission;
      const bOverdue = bDate < now && !bSubmission;
      
      if (aOverdue && !bOverdue) return -1; // Overdue tasks first
      if (!aOverdue && bOverdue) return 1;
      
      // If showing completed, prioritize current tasks after overdue
      if (showCompleted) {
        const aOverdueCompleted = aDate < now;
        const bOverdueCompleted = bDate < now;
        if (aOverdueCompleted && !bOverdueCompleted) return 1; // Current tasks before completed overdue
        if (!aOverdueCompleted && bOverdueCompleted) return -1;
      }
      
      // Sort by date (earliest first)
      return aDate.getTime() - bDate.getTime();
    });

  // Get relevant events (today, tomorrow, this week)
  const relevantEvents = events
    .filter(event => {
      const startDate = new Date(event.start_datetime);
      const now = new Date();
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // If showing completed, include past events too
      if (showCompleted) {
        return startDate <= endOfWeek;
      }
      
      // Show events starting today or later
      return startDate >= now && startDate <= endOfWeek;
    })
    .sort((a, b) => {
      const aDate = new Date(a.start_datetime);
      const bDate = new Date(b.start_datetime);
      const now = new Date();
      
      // If showing completed, prioritize current events first
      if (showCompleted) {
        const aPast = aDate < now;
        const bPast = bDate < now;
        if (aPast && !bPast) return 1; // Current events first
        if (!aPast && bPast) return -1;
      }
      
      // Prioritize events today
      const aToday = aDate.toDateString() === now.toDateString();
      const bToday = bDate.toDateString() === now.toDateString();
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;
      
      // Then sort by date
      return aDate.getTime() - bDate.getTime();
    });



  return (
    <div className="space-y-8">
      <Card className="border-0 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-900 dark:to-indigo-900 text-white" data-tour="dashboard-overview">
        <CardHeader className="p-5 sm:p-6">
          <CardTitle className="text-2xl sm:text-3xl">Welcome back, {firstName}!</CardTitle>
          <CardDescription className="text-white/80 text-sm sm:text-base">
            Continue your learning journey with Master Education
          </CardDescription>
        </CardHeader>
        <CardFooter className="p-5 sm:p-6 pt-0">
          <div className="flex flex-wrap gap-3">
            <Button onClick={onGoToAllCourses} variant="secondary">
              Go to courses
            </Button>
            <Button 
              onClick={() => setShowDailyQuestions(true)}
              // disabled={dailyQuestionsCompleted} // Allow viewing results
              variant={"outline"}
              className={`flex items-center gap-2 text-black dark:text-white`}            >
              {dailyQuestionsCompleted 
                ? dailyQuestionsScore 
                  ? `Result: ${dailyQuestionsScore.score}/${dailyQuestionsScore.total} ✓` 
                  : 'Tasks completed ✓' 
                : 'Daily questions'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-2" data-tour="dashboard-stats">
        <Card className="h-fit">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 p-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-bold">{coursesCount}</div>
              <div className="text-muted-foreground text-sm">My courses</div>
              {progressData && (
                <div className="text-xs text-green-600 mt-1">
                  {progressData.completed_lessons}/{progressData.total_lessons} lessons completed
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-3">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-bold">{totalStudyHours}h</div>
              <div className="text-muted-foreground text-sm">Study time</div>
              {progressData && (
                <div className="text-xs text-blue-600 mt-1">
                  {progressData.total_time_spent_minutes} minutes total
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3">
              <LineChart className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-3xl font-bold">{overallProgress}%</div>
              <div className="text-muted-foreground text-sm">Progress Overview</div>
              {progressData && (
                <div className="text-xs text-emerald-600 mt-1">
                  {progressData.completed_steps}/{progressData.total_steps} steps completed
                </div>
              )}
            </div>
            {/* Compact Progress Chart */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: overallProgress },
                      { name: 'Remaining', value: 100 - overallProgress }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={28}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-1 space-y-6">
          {/* Leaderboard - prominent placement */}
          <StudentLeaderboard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Todo list
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-completed" 
                    checked={showCompleted}
                    onCheckedChange={(checked) => setShowCompleted(checked as boolean)}
                  />
                  <label 
                    htmlFor="show-completed" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Show completed tasks
                  </label>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTodo ? (
                <div className="text-center py-4 text-gray-500">Loading deadlines...</div>
              ) : (
                <div className="max-h-[19.5rem] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                  {/* Combined assignments and events */}
                  {(() => {
                    const allDeadlines = [
                      ...relevantAssignments.map(assignment => ({
                        id: `assignment-${assignment.id}`,
                        assignmentId: assignment.id,
                        title: assignment.title,
                        date: assignment.due_date,
                        type: 'assignment' as const,
                        status: getAssignmentStatus(assignment),
                        description: assignment.description
                      })),
                      ...relevantEvents.map(event => ({
                        id: `event-${event.id}`,
                        eventId: event.id,
                        title: event.title,
                        date: event.start_datetime,
                        type: 'event' as const,
                        eventType: event.event_type,
                        description: event.description,
                        isOnline: event.is_online,
                        location: event.location
                      }))
                    ].filter(deadline => deadline.date) // Filter out items without dates
                    .sort((a, b) => {
                      const aDate = new Date(a.date!);
                      const bDate = new Date(b.date!);
                      
                      // Sort by date (earliest first)
                      return aDate.getTime() - bDate.getTime();
                    });

                    return allDeadlines.length > 0 ? (
                      allDeadlines.map((deadline) => (
                        <div 
                          key={deadline.id} 
                          className="flex items-center gap-3 p-2 border border-border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary cursor-pointer transition-colors"
                          onClick={() => {
                            if (deadline.type === 'assignment' && 'assignmentId' in deadline) {
                              navigate(`/homework/${deadline.assignmentId}`);
                            } else if (deadline.type === 'event' && 'eventId' in deadline) {
                              navigate(`/calendar`);
                            }
                          }}
                        >
                          {deadline.type === 'assignment' ? (
                            <>
                              <deadline.status.icon className="h-4 w-4 text-gray-500" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{deadline.title}</div>
                                <div className="text-xs text-gray-500">
                                  Due {formatDate(deadline.date!)}
                                </div>
                              </div>
                              <Badge className={`text-xs ${deadline.status.color}`}>
                                {deadline.status.status.replace('_', ' ')}
                              </Badge>
                            </>
                          ) : (
                            <>
                              {(() => {
                                const EventIcon = getEventIcon(deadline.eventType);
                                return <EventIcon className="h-4 w-4 text-gray-500" />;
                              })()}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{deadline.title}</div>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(deadline.date!)}
                                </div>
                              </div>
                              <Badge className={`text-xs ${getEventColor(deadline.eventType)}`}>
                                {deadline.eventType.replace('_', ' ')}
                              </Badge>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No current tasks
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your Teacher Card */}
          {progressData && progressData.courses && progressData.courses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Your Teacher
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // If we have group teachers, display them first
                  if (progressData.group_teachers && progressData.group_teachers.length > 0) {
                    return (
                      <div className="space-y-3">
                        {progressData.group_teachers.map(teacher => (
                          <div key={teacher.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                                {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{teacher.name}</div>
                                <div className="text-xs text-gray-500">Group Teacher</div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Navigate to chat and start conversation with teacher
                                navigate('/chat', { state: { contactUserId: teacher.id } });
                              }}
                              className="flex items-center gap-1"
                            >
                              <MessageCircle className="h-4 w-4" />
                              Contact
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Fallback: Get unique teachers from all courses
                  const uniqueTeachers = Array.from(
                    new Map(
                      progressData.courses.map(course => [
                        course.teacher_id,
                        { id: course.teacher_id, name: course.teacher_name }
                      ])
                    ).values()
                  );

                  return uniqueTeachers.length > 0 ? (
                    <div className="space-y-3">
                      {uniqueTeachers.map(teacher => (
                        <div key={teacher.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                              {teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{teacher.name}</div>
                              <div className="text-xs text-gray-500">
                                {progressData.courses.filter(c => c.teacher_id === teacher.id).length} course(s)
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Navigate to chat and start conversation with teacher
                              navigate('/chat', { state: { contactUserId: teacher.id } });
                            }}
                            className="flex items-center gap-1"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Contact
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No teacher information available
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="courses" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 dark:bg-secondary">
              <TabsTrigger 
                value="courses" 
                className="flex items-center gap-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:shadow-none"
              >
                <BookOpen className="h-4 w-4" />
                Courses
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="flex items-center gap-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:shadow-none"
              >
                <LineChart className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

        <TabsContent value="courses" className="mt-4">
          {isLoadingProgress ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Loading progress...</CardTitle>
                <CardDescription>
                  Loading your course progress information.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : progressData?.courses && progressData.courses.length > 0 ? (
            <div className="space-y-6" data-tour="recent-courses">
              {/* Course Progress Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {progressData.courses.map((course) => (
                  <Card key={course.course_id} className="hover:shadow-lg transition-shadow overflow-hidden">
                    {/* Course Image */}
                    {course.cover_image_url ? (
                      <div className="relative h-48 bg-gray-200">
                        <img
                          src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + course.cover_image_url}
                          alt={course.course_title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.style.display = 'none';
                          }}
                        />
                        {/* Progress Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                          <div className="flex items-center justify-between text-white">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm font-bold">{course.completion_percentage}%</span>
                          </div>
                          <Progress 
                            value={course.completion_percentage} 
                            className="h-1 mt-2"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <div className="text-center text-white">
                          <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-80" />
                          <div className="text-sm font-medium opacity-90">{course.course_title}</div>
                        </div>
                        {/* Progress Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                          <div className="flex items-center justify-between text-white">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm font-bold">{course.completion_percentage}%</span>
                          </div>
                          <Progress 
                            value={course.completion_percentage} 
                            className="h-1 mt-2"
                          />
                        </div>
                      </div>
                    )}
                    
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg truncate">{course.course_title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar - Only show if no image */}
                      {!course.cover_image_url && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Course progress</span>
                            <span className={`font-medium ${getProgressColor(course.completion_percentage)}`}>
                              {course.completion_percentage}%
                            </span>
                          </div>
                          <Progress 
                            value={course.completion_percentage} 
                            className="h-2"
                          />
                        </div>
                      )}
                      {/* Continue Button */}
                      <Button 
                        onClick={() => onContinueCourse(course.course_id.toString())}
                        className="w-full"
                        variant={course.completion_percentage === 100 ? "outline" : "default"}
                      >
                        {course.completion_percentage === 100 ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Course completed
                          </>
                        ) : (
                          <>
                            <Target className="w-4 h-4 mr-2" />
                            Continue learning
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No available courses</CardTitle>
                <CardDescription>
                  It looks like you don't have any courses yet. Go to the catalog to start learning.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={onGoToAllCourses}>Find course</Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {isLoadingProgress ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Loading activity...</CardTitle>
                <CardDescription>
                  Loading your activity information.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : progressData ? (
            <div className="space-y-6">

              {/* Course Progress Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed course progress</CardTitle>
                </CardHeader>
                <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Lessons</TableHead>
                        <TableHead>Steps</TableHead>
                        <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                      {progressData.courses.map((course) => (
                        <TableRow key={course.course_id}>
                          <TableCell className="font-medium">{course.course_title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={course.completion_percentage} 
                                className="w-16 h-2"
                              />
                              <span className={`text-sm font-medium ${getProgressColor(course.completion_percentage)}`}>
                                {course.completion_percentage}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {course.completed_lessons}/{course.total_lessons}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {course.completed_steps}/{course.total_steps}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {course.time_spent_minutes} min
                            </span>
                          </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No activity yet</CardTitle>
                <CardDescription>
                  Your recent activity will be displayed here: completed lessons, submitted assignments, etc.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" onClick={onGoToAllCourses}>Go to courses</Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>
        </div>
      </div>
      
      {/* Daily Questions Popup - controlled from dashboard button */}
      <DailyQuestionsPopup 
        controlled={true}
        isOpen={showDailyQuestions}
        onOpenChange={setShowDailyQuestions}
        onComplete={() => {
          setDailyQuestionsCompleted(true);
          // Don't close immediately to show results
          // setShowDailyQuestions(false); 
          loadDailyQuestionsStatus(); // Reload to get the score
        }}
      />
    </div>
  );
}


