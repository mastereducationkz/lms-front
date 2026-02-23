import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import type { AdminDashboard as AdminDashboardType } from '../../types';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  UserCheck, 
  Plus,
  UserPlus,
  Shield,
  Activity,
  BarChart3,
  Unlock
} from 'lucide-react';
import Loader from '../../components/Loader';
import { Button } from '../../components/ui/button';

interface MissingAttendanceReminder {
  event_id: number;
  title: string;
  group_name: string;
  group_id?: number | null;
  event_date: string;
  expected_students: number;
  recorded_students: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getAdminDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Loader size="xl" animation="spin" color="#2563eb" />;
  }

  if (!dashboard) {
    return <div className="text-center py-8">Failed to load dashboard</div>;
  }

  const { stats, recent_users, recent_groups, recent_courses } = dashboard;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground flex items-center">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 mr-3 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">System overview and management</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={() => navigate('/admin/users?tab=1')}
            variant="outline"
            className="flex items-center gap-2 px-4 py-2 rounded-lg w-full sm:w-auto"
            data-tour="groups-section"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </Button>
          <Button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg w-full sm:w-auto"
            data-tour="users-management"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Missing Attendance Reminders */}
      {stats.missing_attendance_reminders && stats.missing_attendance_reminders.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-yellow-900 dark:text-yellow-300">
              Attendance Required ({stats.missing_attendance_reminders.length})
            </h3>
            <Button
              onClick={() => navigate('/attendance')}
              size="sm"
              variant="outline"
              className="text-xs h-6 px-2 border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:border-yellow-800"
            >
              Go to Attendance
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.missing_attendance_reminders.slice(0, 5).map((reminder: MissingAttendanceReminder) => (
              <div key={reminder.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-yellow-100 dark:border-yellow-800 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-yellow-900 dark:text-yellow-300 truncate font-medium">{reminder.title}</p>
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
                    className="text-[11px] h-6 px-2 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  >
                    Mark
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6" data-tour="dashboard-overview">
        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total_users}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              +{stats.recent_registrations} new this week
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Students</p>
              <p className="text-3xl font-bold text-green-600">{stats.total_students}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.total_active_enrollments} active enrollments
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Teachers</p>
              <p className="text-3xl font-bold text-purple-600">{stats.total_teachers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              Managing {stats.total_courses} courses
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Courses</p>
              <p className="text-3xl font-bold text-orange-600">{stats.total_courses}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.total_curators} curators
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Users */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Recent Users
            </h2>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recent_users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-secondary rounded-lg">
                <div>
<p className="font-medium text-sm">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  user.role === 'teacher' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                  user.role === 'curator' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Groups */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <GraduationCap className="w-5 h-5 mr-2 text-green-600" />
              Recent Groups
            </h2>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recent_groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-secondary rounded-lg">
                <div>
                  <p className="font-medium text-sm">{group.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {group.teacher_name} • {group.student_count} students
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  group.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {group.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Courses */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-orange-600" />
              Recent Courses
            </h2>
            <button
              onClick={() => navigate('/teacher/courses')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recent_courses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-secondary rounded-lg">
                <div>
                  <p className="font-medium text-sm">{course.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {course.teacher_name} • {course.module_count} modules
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  course.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {course.is_active ? 'Active' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-card rounded-lg border p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            data-tour="users-management"
          >
            <Users className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="font-medium">Manage Users</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add, edit, or remove users</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/groups')}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            data-tour="groups-section"
          >
            <GraduationCap className="w-5 h-5 text-green-600" />
            <div className="text-left">
              <p className="font-medium">Manage Groups</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create and organize groups</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/teacher/courses')}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            data-tour="courses-management"
          >
            <BookOpen className="w-5 h-5 text-orange-600" />
            <div className="text-left">
              <p className="font-medium">View Courses</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor course activity</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/manual-unlocks')}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
          >
            <Unlock className="w-5 h-5 text-indigo-600" />
            <div className="text-left">
              <p className="font-medium">Manual Unlocks</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Override course progression</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/users?role=student')}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            data-tour="analytics-nav"
          >
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <div className="text-left">
              <p className="font-medium">Student Progress</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track learning analytics</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
