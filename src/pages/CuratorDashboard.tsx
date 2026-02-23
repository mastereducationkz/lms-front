import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Users, 
  BarChart3, 
  ChevronLeft,
  ChevronRight,
  Activity,
  FileText
} from 'lucide-react';
import Skeleton from '../components/Skeleton';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

export default function CuratorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [studentsProgress, setStudentsProgress] = useState<any[]>([]);
  
  // UI state
  const [studentPage, setStudentPage] = useState(1);
  const studentsPerPage = 10;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [
        dashboardStats, 
        progressData
      ] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getCuratorStudentsProgress()
      ]);
      
      setStats((dashboardStats as any).stats || dashboardStats || {});
      setStudentsProgress(progressData);
    } catch (error) {
      console.error('Failed to load curator dashboard:', error);
    } finally {
      setLoading(false);
    }
  };


  // Pagination for students
  const totalStudentPages = Math.ceil(studentsProgress.length / studentsPerPage);
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * studentsPerPage;
    return studentsProgress.slice(start, start + studentsPerPage);
  }, [studentsProgress, studentPage]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const firstName = user?.full_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Куратор';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">С возвращением, {firstName}!</h1>
          <p className="text-gray-600 mt-1">
            Обзор успеваемости ваших групп и студентов
          </p>
        </div>
      </div>

      {/* Missing Attendance Reminders */}
      {stats?.missing_attendance_reminders && stats.missing_attendance_reminders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-yellow-900 dark:text-yellow-200">
              Посещаемость не заполнена ({stats.missing_attendance_reminders.length})
            </h3>
            <Button
              onClick={() => navigate('/attendance')}
              size="sm"
              variant="outline"
              className="text-xs h-6 px-2 border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100"
            >
              Перейти к посещаемости
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.missing_attendance_reminders.slice(0, 3).map((reminder: any) => (
              <div key={reminder.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-yellow-100 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
<p className="text-yellow-900 dark:text-yellow-200 truncate font-medium">{reminder.title}</p>
                                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                    {reminder.group_name} • {new Date(reminder.event_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
<span className="text-[11px] text-yellow-700 dark:text-yellow-400">
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
                    className="text-[11px] h-6 px-2 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100"
                  >
                    Заполнить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Submissions & Progress */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Student Progress Table */}
          <Card className="shadow-sm border-0">
            <CardHeader className="px-6 py-4 border-b border-gray-100 bg-white rounded-t-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Прогресс студентов</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        {stats?.total_students || studentsProgress.length || 0} студентов
                      </Badge>
                      <Badge variant="secondary" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 hover:bg-green-50 dark:hover:bg-green-900/20">
                        {stats?.total_groups || 0} групп
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Обзор успеваемости студентов по активным курсам</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium">Студент</th>
                      <th className="text-left px-6 py-3 font-medium">Группа и курс</th>
                      <th className="text-left px-6 py-3 font-medium">Текущий урок</th>
                      <th className="text-left px-6 py-3 font-medium">Прогресс</th>
                      <th className="text-left px-6 py-3 font-medium">Последняя активность</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paginatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          Студенты в ваших группах не найдены.
                        </td>
                      </tr>
                    ) : (
                      paginatedStudents.map((student, index) => (
                        <tr key={`${student.student_id}-${student.course_id}-${index}`} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                                <AvatarImage src={student.student_avatar} />
                                <AvatarFallback className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs">
                                  {student.student_name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">{student.student_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{student.student_email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {student.group_name && (
                                <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 h-4 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                                  {student.group_name}
                                </Badge>
                              )}
                              <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[150px]" title={student.course_title}>
                                {student.course_title}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-700 dark:text-gray-200 truncate max-w-[180px]" title={student.current_lesson_title}>
                                {student.current_lesson_title || "Не начат"}
                              </span>
                              {student.current_lesson_id && (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                      style={{ width: `${student.lesson_progress || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{student.lesson_progress || 0}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className="w-10 h-10 transform -rotate-90">
                                  <circle
                                    className="text-gray-100 dark:text-gray-700"
                                    strokeWidth="3"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="18"
                                    cx="20"
                                    cy="20"
                                  />
                                  <circle
                                    className={student.overall_progress >= 100 ? "text-green-500 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}
                                    strokeWidth="3"
                                    strokeDasharray={113}
                                    strokeDashoffset={113 - ((student.overall_progress || 0) / 100) * 113}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="18"
                                    cx="20"
                                    cy="20"
                                  />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-200">
                                  {student.overall_progress || 0}%
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {student.last_activity ? (
                              <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
                                <Activity className="w-3 h-3 mr-1.5 text-gray-400 dark:text-gray-500" />
                                {new Date(student.last_activity).toLocaleDateString(undefined, {
                                  month: 'short', day: 'numeric'
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500 italic">Нет активности</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalStudentPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Показано <span className="font-medium">{((studentPage - 1) * studentsPerPage) + 1}</span> –{' '}
                    <span className="font-medium">{Math.min(studentPage * studentsPerPage, studentsProgress.length)}</span> из{' '}
                    <span className="font-medium">{studentsProgress.length}</span> студентов
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                      disabled={studentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 px-2">
                      Стр. {studentPage} из {totalStudentPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                      disabled={studentPage === totalStudentPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sidebar Actions - Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card data-tour="groups-section">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate('/curator/homeworks')}
              >
                <FileText className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                Домашние задания
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate('/analytics')}
              >
                <BarChart3 className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                Подробная аналитика
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate('/chat')}
              >
                <Users className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                Написать студентам
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
