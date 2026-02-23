import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
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

export default function HeadCuratorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [curatorTasksSummary, setCuratorTasksSummary] = useState<any[]>([]);
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
      const promises: Promise<any>[] = [apiClient.getDashboardStats(groupId, startDate, endDate)];
      if (user?.role === 'head_curator') {
        promises.push(apiClient.getCuratorsSummary());
      }
      const settled = await Promise.allSettled(promises);
      const statsResult = settled[0];
      setData(statsResult.status === 'fulfilled' ? statsResult.value : null);
      if (user?.role === 'head_curator' && settled[1]?.status === 'fulfilled') {
        setCuratorTasksSummary(settled[1].value || []);
      } else {
        setCuratorTasksSummary([]);
      }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Рады видеть вас, {user?.name}!</h1>
          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {user?.role === 'head_curator' 
              ? "Обзор эффективности кураторов и активности студентов" 
              : "Обзор успеваемости ваших групп и активности студентов"}
            {loading && (
              <span className="inline-flex items-center text-xs text-blue-500 animate-pulse font-medium">
                • Обновление данных...
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px] bg-white border-gray-200 dark:bg-card dark:border-border">
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
                  "w-[260px] justify-start text-left font-normal bg-white dark:bg-card",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
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
              <div className="flex flex-col border-r border-gray-200 dark:border-border p-2 gap-1 min-w-[120px]">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 px-2 py-1 uppercase tracking-wider">Периоды</p>
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
              className="text-xs h-6 px-2 border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:border-yellow-800 dark:hover:bg-yellow-900/20"
            >
              Перейти к посещаемости
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.missing_attendance_reminders.slice(0, 3).map((reminder: any) => (
              <div key={reminder.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-yellow-100 dark:border-yellow-800 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-yellow-900 dark:text-yellow-300 truncate font-medium">{reminder.title}</p>
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                    {reminder.group_name} • {new Date(reminder.event_date).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-yellow-700">
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
                    className="text-[11px] h-6 px-2 text-yellow-700 hover:bg-yellow-100"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <CardContent className="p-6 text-white">
            <p className="text-blue-100 text-sm font-medium">
              {user?.role === 'head_curator' ? "Всего кураторов" : "Всего групп"}
            </p>
            <h3 className="text-3xl font-bold mt-1 text-white">
              {user?.role === 'head_curator' ? stats.total_curators : stats.total_groups}
            </h3>
            <div className="mt-4 text-xs text-blue-100 flex items-center">
              {user?.role === 'head_curator' ? "Активных на платформе" : "Прикреплено к вам"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Студентов всего</p>
            <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-foreground">{stats.total_students}</h3>
            <div className="mt-4 text-xs text-indigo-600 flex items-center font-medium">
              {stats.active_students_7d} активны за 7д
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-gray-500 text-sm font-medium">Просрочено ДЗ</p>
            <h3 className="text-3xl font-bold mt-1 text-red-600">
              {stats.total_overdue || 0}
            </h3>
            <div className="mt-4 text-xs text-red-500 flex items-center font-medium">
              Требует внимания
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Неактивных</p>
            <h3 className="text-3xl font-bold mt-1 text-amber-600">
              {stats.inactive_students || 0}
            </h3>
            <div className="mt-4 text-xs text-amber-600 flex items-center font-medium">
              Бездействуют на протяжении 7 дней
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Активность студентов (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}`;
                    }}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`${val}%`, 'Активность']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="#3B82F6" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
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
              className="text-gray-400 hover:text-gray-600 cursor-help p-1"
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F9FAFB' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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

      {/* Задачи кураторов — только для head_curator */}
      {user?.role === 'head_curator' && (
        <Card className="shadow-sm border-0 overflow-hidden">
          <CardHeader className="bg-white dark:bg-card flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Задачи кураторов</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => navigate('/curator/tasks')}
            >
              Подробнее <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {curatorTasksSummary.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">
                Нет задач кураторов
              </div>
            ) : (
              <>
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-6">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Выполнено</span>
                    <p className="text-xl font-bold text-emerald-600">
                      {curatorTasksSummary.reduce((s, c) => s + (c.completed || 0), 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">В ожидании</span>
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                      {curatorTasksSummary.reduce((s, c) => s + (c.pending || 0) + (c.in_progress || 0), 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Просрочено</span>
                    <p className="text-xl font-bold text-red-600">
                      {curatorTasksSummary.reduce((s, c) => s + (c.overdue || 0), 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Всего</span>
                    <p className="text-xl font-bold text-gray-900 dark:text-foreground">
                      {curatorTasksSummary.reduce((s, c) => s + (c.total || 0), 0)}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50/80 dark:bg-secondary/30 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-border uppercase text-[10px] font-bold">
                      <tr>
                        <th className="text-left px-6 py-4">Куратор</th>
                        <th className="text-center px-4 py-4">Выполнено</th>
                        <th className="text-center px-4 py-4">В процессе</th>
                        <th className="text-center px-4 py-4">Ожидает</th>
                        <th className="text-center px-4 py-4">Просрочено</th>
                        <th className="text-center px-4 py-4">Всего</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                      {curatorTasksSummary.map((c: any) => (
                        <tr key={c.curator_id} className="hover:bg-gray-50/50 dark:hover:bg-secondary/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900 dark:text-foreground">{c.curator_name || 'Unknown'}</td>
                          <td className="px-4 py-4 text-center">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {c.completed || 0}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400">{c.in_progress || 0}</td>
                          <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400">{c.pending || 0}</td>
                          <td className="px-4 py-4 text-center">
                            <Badge variant={c.overdue > 0 ? "destructive" : "secondary"} className={c.overdue === 0 ? "bg-green-50 text-green-700" : ""}>
                              {c.overdue || 0}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-center font-medium text-gray-700 dark:text-gray-300">{c.total || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Таблица кураторов/групп */}
      <Card className="shadow-sm border-0 overflow-hidden">
        <CardHeader className="bg-white dark:bg-card">
          <CardTitle className="text-lg font-bold">
            {user?.role === 'head_curator' ? "Сводная таблица по кураторам" : "Сводная таблица по группам"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-secondary/30 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-border uppercase text-[10px] font-bold">
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
              <tbody className="divide-y divide-gray-100 dark:divide-border">
                {curatorPerformance.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xs">
                            {item.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-gray-900 dark:text-foreground">{item.name}</span>
                      </div>
                    </td>
                    {user?.role === 'head_curator' && (
                       <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 font-medium">{item.groups_count}</td>
                    )}
                    <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 font-medium">{item.students_count}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${item.avg_progress}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{item.avg_progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Badge variant={item.overdue_count > 5 ? "destructive" : "secondary"} className={item.overdue_count === 0 ? "bg-green-50 text-green-700 border-green-100 hover:bg-green-50" : ""}>
                          {item.overdue_count}
                        </Badge>
                        <span className="text-[10px] text-gray-500 font-medium">
                          из {item.total_due} ({item.overdue_perc}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                          {item.pending_grading}
                        </Badge>
                        <span className="text-[10px] text-gray-500 font-medium">
                          из {item.total_submissions} ({item.pending_perc}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
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
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-700">
              Группы с просрочками
            </CardTitle>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Здесь отображаются группы, в которых есть студенты с невыполненными вовремя заданиями или заданиями, сданными после дедлайна.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-50/50 text-red-800 text-[10px] uppercase font-bold border-b border-red-100">
                <tr>
                  <th className="px-6 py-3 text-left">Группа</th>
                  <th className="px-6 py-3 text-left">Куратор</th>
                  <th className="px-6 py-3 text-center">Просрочено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {atRiskGroups.map((group: any) => (
                  <tr key={group.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{group.title}</td>
                    <td className="px-6 py-4 text-gray-600">{group.curator}</td>
                    <td className="px-6 py-4 text-center font-black text-red-600">{group.overdue_count}</td>
                  </tr>
                ))}
                {atRiskGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-400 italic bg-white dark:bg-card">
                      Проблемных групп не обнаружено. Все задания под контролем! ✨
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
