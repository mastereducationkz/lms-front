import { useEffect, useState } from 'react';
import { chartColors, chartTick, chartTooltipStyle } from '../lib/chartTheme';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { lessonPath } from '../lib/lessonLinks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  ChevronRight,
  Info,
  Calendar as CalendarIcon
} from 'lucide-react';
import Skeleton from '../components/Skeleton';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '../lib/utils';
import StudentSearchBox from '../components/StudentSearchBox';
import InstallAppCard from '../components/pwa/InstallAppCard';
import { formatDate } from '../lib/i18n';

export default function HeadCuratorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  
  // Date Range State
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    loadGroups();
  }, []);
  
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadDashboardData(
        selectedGroupId === "all" ? undefined : parseInt(selectedGroupId),
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );
    }
  }, [selectedGroupId, dateRange, user?.role]);

  const loadGroups = async () => {
    try {
      const res = user?.role === 'curator' 
        ? await apiClient.getCuratorGroups() 
        : await apiClient.getGroups();
      setGroups(res);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadDashboardData = async (groupId?: number, startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      const [statsResult] = await Promise.allSettled([
        apiClient.getDashboardStats(groupId, startDate, endDate),
      ]);
      setData(statsResult.status === 'fulfilled' ? statsResult.value : null);
      if (statsResult.status === 'rejected') {
        console.error('Failed to load dashboard:', statsResult.reason);
      }
    } catch (error) {
      console.error('Failed to load HoC dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const curatorPerformance = stats.curator_performance || [];
  const activityTrends = stats.activity_trends || [];
  const atRiskGroups = data?.recent_courses || [];

  return (
    <div className="space-y-6">
      <StudentSearchBox className="max-w-md" />
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Рады видеть вас, {user?.name}!</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {user?.role === 'head_curator' 
              ? "Обзор эффективности кураторов и активности студентов" 
              : "Обзор успеваемости ваших групп и активности студентов"}
            {loading && (
              <span className="inline-flex items-center text-xs text-brand animate-pulse font-medium">
                • Обновление данных...
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-w-full">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px] max-w-full bg-card border-border">
              <SelectValue placeholder="Все группы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все группы</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "w-[260px] max-w-full justify-start text-left font-normal bg-card",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd.MM.yyyy")} -{" "}
                      {format(dateRange.to, "dd.MM.yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd.MM.yyyy")
                  )
                ) : (
                  <span>Выберите период</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-row" align="end">
              <div className="flex flex-col border-r border-border p-2 gap-1 min-w-[120px]">
                <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">Периоды</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal text-xs"
                  onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                >
                  7 дней
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal text-xs"
                  onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                >
                  30 дней
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal text-xs"
                  onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}
                >
                  90 дней
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal text-xs"
                  onClick={() => setDateRange({ from: new Date(2024, 0, 1), to: new Date() })}
                >
                  Весь период
                </Button>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Inside the installed app: «turn on notifications on this device» (components/pwa). */}
      <InstallAppCard variant="teacher" only="push" />

      {/* Missing Attendance Reminders */}
      {stats?.missing_attendance_reminders && stats.missing_attendance_reminders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-yellow-900 dark:text-yellow-300">
              Посещаемость не заполнена ({stats.missing_attendance_reminders.length})
            </h3>
            <Button
              onClick={() => navigate('/attendance')}
              size="sm"
              variant="outline"
              className="text-xs h-6 px-2 border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 hover:dark:bg-yellow-500/15 dark:border-yellow-800 dark:hover:bg-yellow-900/20"
            >
              Перейти к посещаемости
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.missing_attendance_reminders.slice(0, 3).map((reminder: any) => (
              <div key={reminder.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-yellow-100 dark:border-yellow-800 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  {/* The lesson's own page, at its register (2026-09-28). */}
                  <Link to={lessonPath(reminder.event_id, 'register')} className="block text-yellow-900 dark:text-yellow-300 truncate font-medium hover:underline">
                    {reminder.title}
                  </Link>
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                    {reminder.group_name} • {formatDate(reminder.event_date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-yellow-700 dark:text-yellow-300">
                    {reminder.recorded_students}/{reminder.expected_students}
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
                    className="text-[11px] h-6 px-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 hover:dark:bg-yellow-500/15"
                  >
                    Заполнить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Верхние карточки KPI */}
      <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white dark:from-brand-surface dark:to-brand-surface dark:border dark:border-brand-border dark:text-brand-surface-foreground">
          <CardContent className="p-6">
            <p className="text-blue-100 dark:text-brand-subtle-foreground text-sm font-medium">
              {user?.role === 'head_curator' ? "Всего кураторов" : "Всего групп"}
            </p>
            <h3 className="text-3xl font-bold mt-1">
              {user?.role === 'head_curator' ? stats.total_curators : stats.total_groups}
            </h3>
            <div className="mt-4 text-xs text-blue-100 dark:text-brand-subtle-foreground flex items-center">
              {user?.role === 'head_curator' ? "Активных на платформе" : "Прикреплено к вам"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm font-medium">Студентов всего</p>
            <h3 className="text-3xl font-bold mt-1 text-foreground dark:text-foreground">{stats.total_students}</h3>
            <div className="mt-4 text-xs text-brand flex items-center font-medium">
              {stats.active_students_7d} активны за 7д
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm font-medium">Просрочено ДЗ</p>
            <h3 className="text-3xl font-bold mt-1 text-red-600 dark:text-red-300">
              {stats.total_overdue || 0}
            </h3>
            <div className="mt-4 text-xs text-red-500 dark:text-red-400 flex items-center font-medium">
              Требует внимания
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm font-medium">Неактивных</p>
            <h3 className="text-3xl font-bold mt-1 text-amber-600 dark:text-amber-300">
              {stats.inactive_students || 0}
            </h3>
            <div className="mt-4 text-xs text-amber-600 dark:text-amber-300 flex items-center font-medium">
              Бездействуют на протяжении 7 дней
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-6">
        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Активность студентов (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      return formatDate(val, { day: 'numeric', month: 'short' }).replace('.', '');
                    }}
                    axisLine={false}
                    tickLine={false}
                    tick={chartTick(12)}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={chartTick(12)}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    contentStyle={chartTooltipStyle}
                    formatter={(val: number) => [`${val}%`, 'Активность']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke={chartColors.brand} 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: chartColors.brand, strokeWidth: 2, stroke: chartColors.surface }}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold">
              {user?.role === 'head_curator' ? "Эффективность кураторов (%)" : "Прогресс по группам (%)"}
            </CardTitle>
            <div 
              className="text-muted-foreground hover:text-muted-foreground cursor-help p-1"
              title={user?.role === 'head_curator' 
                ? "Эффективность рассчитывается на основе среднего прогресса студентов, отсутствия просрочек и скорости проверки работ."
                : "Средний прогресс освоения курсов студентами в каждой группе."}
            >
              <Info className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curatorPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={chartTick(11)}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={chartTick(12)}
                  />
                  <Tooltip 
                    cursor={{ fill: chartColors.cursor }}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="avg_progress" name="Ср. прогресс (%)" radius={[4, 4, 0, 0]}>
                    {curatorPerformance.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3B82F6' : '#6366F1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Таблица кураторов/групп */}
      <Card className="shadow-sm border-0 overflow-hidden">
        <CardHeader className="bg-card dark:bg-card">
          <CardTitle className="text-lg font-bold">
            {user?.role === 'head_curator' ? "Сводная таблица по кураторам" : "Сводная таблица по группам"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-secondary/30 text-muted-foreground border-b border-border uppercase text-[10px] font-bold">
                <tr>
                  <th className="text-left px-6 py-4">
                    {user?.role === 'head_curator' ? "Куратор" : "Группа"}
                  </th>
                  {user?.role === 'head_curator' && <th className="text-center px-4 py-4">Группы</th>}
                  <th className="text-center px-4 py-4">Студенты</th>
                  <th className="text-center px-4 py-4">Ср. прогресс</th>
                  <th className="text-center px-4 py-4">Просрочено</th>
                  <th className="text-center px-4 py-4">На проверке</th>
                  <th className="text-right px-6 py-4">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border">
                {curatorPerformance.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-brand-subtle text-brand-subtle-foreground font-bold text-xs">
                            {item.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground dark:text-foreground">{item.name}</span>
                      </div>
                    </td>
                    {user?.role === 'head_curator' && (
                       <td className="px-4 py-4 text-center text-muted-foreground font-medium">{item.groups_count}</td>
                    )}
                    <td className="px-4 py-4 text-center text-muted-foreground font-medium">{item.students_count}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${item.avg_progress}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground">{item.avg_progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Badge variant={item.overdue_count > 5 ? "destructive" : "secondary"} className={item.overdue_count === 0 ? "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-100 hover:bg-green-50 hover:dark:bg-green-500/15" : ""}>
                          {item.overdue_count}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          из {item.total_due} ({item.overdue_perc}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Badge variant="outline" className="border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15">
                          {item.pending_grading}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          из {item.total_submissions} ({item.pending_perc}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-brand hover:text-brand-subtle-foreground hover:bg-brand-surface" 
                        onClick={() => {
                          if (user?.role === 'head_curator') {
                            navigate(`/head-curator/curator/${item.id}`);
                          } else {
                            // Link to Leaderboard for regular curators
                            navigate(`/curator/leaderboard?groupId=${item.id}`);
                          }
                        }}
                      >
                        Обзор <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Группы риска */}
      <Card className="shadow-sm border-0 overflow-hidden">
        <CardHeader className="flex flex-col pb-2">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-700 dark:text-red-300">
              Группы с просрочками
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Здесь отображаются группы, в которых есть студенты с невыполненными вовремя заданиями или заданиями, сданными после дедлайна.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-50/50 dark:bg-red-500/15 text-red-800 dark:text-red-300 text-[10px] uppercase font-bold border-b border-red-100">
                <tr>
                  <th className="px-6 py-3 text-left">Группа</th>
                  <th className="px-6 py-3 text-left">Куратор</th>
                  <th className="px-6 py-3 text-center">Просрочено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {atRiskGroups.map((group: any) => (
                  <tr key={group.id} className="hover:bg-red-50 hover:dark:bg-red-500/15 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{group.title}</td>
                    <td className="px-6 py-4 text-muted-foreground">{group.curator}</td>
                    <td className="px-6 py-4 text-center font-black text-red-600 dark:text-red-300">{group.overdue_count}</td>
                  </tr>
                ))}
                {atRiskGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground italic bg-card dark:bg-card">
                      Проблемных групп не обнаружено. Все задания под контролем!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
