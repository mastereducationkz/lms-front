import { useEffect, useState } from 'react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Calendar as CalendarIcon, ArrowRight, BarChart3, TrendingUp, Users, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '../lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import Skeleton from '../components/Skeleton';

interface MissingAttendanceReminder {
  event_id: number;
  title: string;
  group_name: string;
  group_id?: number | null;
  event_date: string;
  expected_students: number;
  recorded_students: number;
}

interface ManagedCourse {
  id: number;
  title: string;
  description: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeacherStats {
  teacher_id: number;
  teacher_name: string;
  email: string;
  last_activity_date: string | null;
  groups_count: number;
  students_count: number;
  checked_homeworks_count: number;
  total_submissions_count: number;
  feedbacks_given_count: number;
  avg_grading_time_hours: number | null;
  quizzes_graded_count: number;
  homeworks_checked_last_7_days: number;
  homeworks_checked_last_30_days: number;
  missed_attendance_count?: number;
}

interface ActivityHistoryItem {
  date: string;
  submissions_graded: number;
}

interface CourseTeachersData {
  course_id: number;
  course_title: string;
  date_range_start: string | null;
  date_range_end: string | null;
  teachers: TeacherStats[];
  daily_activity: ActivityHistoryItem[];
}

export default function HeadTeacherDashboardPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [teachersData, setTeachersData] = useState<CourseTeachersData | null>(null);
  const [missingAttendance, setMissingAttendance] = useState<MissingAttendanceReminder[]>([]);
  
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  
  // Date Range State
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Sort State
  type SortField = 'teacher_name' | 'groups_count' | 'students_count' | 'checked_homeworks_count' | 'feedbacks_given_count' | 'missed_attendance_count';
  type SortDirection = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<SortField>('checked_homeworks_count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadCourses();
    loadMissingAttendance();
  }, []);

  useEffect(() => {
    if (selectedCourseId && dateRange?.from && dateRange?.to) {
      loadTeachersData(
        parseInt(selectedCourseId),
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );
    }
  }, [selectedCourseId, dateRange]);

  const loadMissingAttendance = async () => {
    try {
      const res = await apiClient.getDashboardStats() as any;
      if (res?.stats?.missing_attendance_reminders) {
        setMissingAttendance(res.stats.missing_attendance_reminders);
      }
    } catch (error) {
      console.error('Failed to load missing attendance:', error);
    }
  };

  const loadCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await apiClient.getHeadTeacherManagedCourses();
      setCourses(res);
      if (res.length > 0) {
        setSelectedCourseId(res[0].id.toString());
      }
    } catch (error) {
      console.error('Failed to load managed courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadTeachersData = async (courseId: number, startDate: string, endDate: string) => {
    try {
      setLoadingTeachers(true);
      // Pass 30 for days as fallback (ignored by backend when dates provided)
      const res = await apiClient.getHeadTeacherCourseTeachers(courseId, 30, startDate, endDate);
      setTeachersData(res);
    } catch (error) {
      console.error('Failed to load teacher statistics:', error);
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction: desc -> asc -> null -> desc
      if (sortDirection === 'desc') setSortDirection('asc');
      else if (sortDirection === 'asc') setSortDirection(null);
      else setSortDirection('desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4 text-slate-700" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4 text-slate-700" />;
    return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
  };

  // Sort teachers
  const sortedTeachers = React.useMemo(() => {
    if (!teachersData?.teachers || !sortDirection) return teachersData?.teachers || [];
    
    const sorted = [...teachersData.teachers].sort((a, b) => {
      let aVal: string | number | undefined = a[sortField];
      let bVal: string | number | undefined = b[sortField];
      
      // Handle undefined values (treat as 0)
      if (aVal === undefined) aVal = 0;
      if (bVal === undefined) bVal = 0;
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [teachersData?.teachers, sortField, sortDirection]);

  const totalTeachers = teachersData?.teachers.length || 0;
  const totalStudents = teachersData?.teachers.reduce((sum, t) => sum + t.students_count, 0) || 0;
  const totalHomeworksChecked = teachersData?.teachers.reduce((sum, t) => sum + t.checked_homeworks_count, 0) || 0;
  const totalFeedbacks = teachersData?.teachers.reduce((sum, t) => sum + t.feedbacks_given_count, 0) || 0;

  if (loadingCourses) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // Prepare chart data
  const activityData = teachersData?.daily_activity || [];
  
  // Sort teachers by activity for comparison chart (Top 10)
  const topTeachers = [...(teachersData?.teachers || [])]
    .sort((a, b) => b.checked_homeworks_count - a.checked_homeworks_count)
    .slice(0, 10);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Head Teacher Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of teacher performance and course activity</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white dark:bg-card dark:border-border p-2 rounded-xl border shadow-sm">
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="w-[240px] border-0 bg-transparent font-medium focus:ring-0">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="h-8 w-px bg-slate-200 dark:bg-border hidden sm:block" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"ghost"}
                className={cn(
                  "w-[260px] justify-start text-left font-normal hover:bg-slate-50",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Missing Attendance Alert */}
      {missingAttendance.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Attendance Not Recorded ({missingAttendance.length})
                </h3>
                <Button
                  onClick={() => navigate('/attendance')}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                >
                  Go to Attendance
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                The following classes ended more than 2 hours ago without attendance records:
              </p>
              <div className="space-y-2">
                {missingAttendance.slice(0, 5).map((reminder) => (
                  <div key={reminder.event_id} className="flex items-center justify-between bg-white/60 dark:bg-card/60 rounded-md px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-300 truncate">{reminder.title}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {reminder.group_name} • {new Date(reminder.event_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {reminder.recorded_students}/{reminder.expected_students} recorded
                      </span>
                      <Button
                        onClick={() => {
                          if (reminder.group_id) {
                            navigate(`/attendance?group=${reminder.group_id}`);
                          } else {
                            navigate('/attendance');
                          }
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                      >
                        Mark
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-foreground">{totalTeachers}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active in this course</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-foreground">{totalStudents}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all groups</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Homework Checked</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalHomeworksChecked}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              out of {teachersData?.teachers.reduce((sum, t) => sum + t.total_submissions_count, 0) || 0} submitted
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Feedbacks Given</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalFeedbacks}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Written comments</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader>
            <CardTitle>Grading Activity</CardTitle>
            <CardDescription>Daily volume of graded assignments across the course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loadingTeachers ? (
                <div className="w-full h-full flex items-center justify-center">
                   <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : activityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorGraded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                      tick={{ fontSize: 12, fill: '#64748b' }} 
                      axisLine={false}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis 
                       allowDecimals={false}
                       tick={{ fontSize: 12, fill: '#64748b' }} 
                       axisLine={false}
                       tickLine={false}
                    />
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       labelFormatter={(label) => format(new Date(label), 'PPP')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="submissions_graded"
                      name="Graded"
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorGraded)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                  <p>No activity data for this period</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Teachers Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle>Top Active Teachers</CardTitle>
            <CardDescription>By homeworks checked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loadingTeachers ? (
                 <div className="w-full h-full flex items-center justify-center">
                   <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : topTeachers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topTeachers} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="teacher_name" 
                      type="category" 
                      width={100} 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val.split(' ')[0]} // Show first name only to save space
                    />
                    <RechartsTooltip
                       cursor={{ fill: '#f8fafc' }}
                       contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="checked_homeworks_count" name="Checked" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                   <Users className="h-8 w-8 mb-2 opacity-50" />
                   <p>No teacher data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Teacher Performance</CardTitle>
          <CardDescription>Detailed breakdown per teacher</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTeachers ? (
            <div className="p-12 flex justify-center">
               <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : teachersData?.teachers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-50/50 dark:bg-secondary/20">
              No teachers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-secondary/50 hover:bg-slate-50/80 dark:hover:bg-secondary/50">
                    <TableHead className="font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('teacher_name')} 
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        Teacher {getSortIcon('teacher_name')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('groups_count')} 
                        className="flex items-center gap-1 mx-auto hover:text-blue-600 transition-colors"
                      >
                        Groups {getSortIcon('groups_count')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('students_count')} 
                        className="flex items-center gap-1 mx-auto hover:text-blue-600 transition-colors"
                      >
                        Students {getSortIcon('students_count')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('checked_homeworks_count')} 
                        className="flex items-center gap-1 mx-auto hover:text-blue-600 transition-colors"
                      >
                        HW Checked {getSortIcon('checked_homeworks_count')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('feedbacks_given_count')} 
                        className="flex items-center gap-1 mx-auto hover:text-blue-600 transition-colors"
                      >
                        Feedbacks {getSortIcon('feedbacks_given_count')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">
                      <button 
                        onClick={() => handleSort('missed_attendance_count')} 
                        className="flex items-center gap-1 mx-auto hover:text-blue-600 transition-colors"
                      >
                        Missed Att. {getSortIcon('missed_attendance_count')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-foreground">Activity Trend</TableHead>
                    <TableHead className="text-right font-bold text-slate-900 dark:text-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTeachers.map((teacher) => (
                    <TableRow 
                      key={teacher.teacher_id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-secondary/30 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/head-teacher/course/${selectedCourseId}/teacher/${teacher.teacher_id}`)}
                    >
                       <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-slate-200 dark:border-border">
                            <AvatarFallback className="bg-white dark:bg-secondary text-slate-700 dark:text-slate-300 font-medium">
                              {teacher.teacher_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-foreground block">{teacher.teacher_name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{teacher.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400">
                        {teacher.groups_count}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400">
                        {teacher.students_count}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 border-green-200 dark:border-green-800">
                            {teacher.checked_homeworks_count} / {teacher.total_submissions_count}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {teacher.total_submissions_count > 0 
                              ? `${Math.round((teacher.checked_homeworks_count / teacher.total_submissions_count) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800">
                           {teacher.feedbacks_given_count}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {(teacher.missed_attendance_count ?? 0) > 0 ? (
                          <Badge variant="secondary" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800">
                            {teacher.missed_attendance_count}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-200 dark:border-slate-600">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                           <span className={teacher.homeworks_checked_last_7_days > 0 ? "text-emerald-600 font-medium" : ""}>
                             {teacher.homeworks_checked_last_7_days} (7d)
                           </span>
                           <span className="text-slate-300 dark:text-slate-400">|</span>
                           <span>{teacher.homeworks_checked_last_30_days} (30d)</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex justify-end">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 group-hover:text-blue-600">
                             <ArrowRight className="h-4 w-4" />
                           </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
