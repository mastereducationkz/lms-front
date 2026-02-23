import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import type { User, Group } from '../types';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  TrendingUp, 
  Search, 
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Clock,
  Target,
  Loader2
} from 'lucide-react';
import Loader from '../components/Loader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { GiveBonusModal } from '../components/gamification/GiveBonusModal';
import { WeeklyAwardsHub } from '../components/gamification/WeeklyAwardsHub';

interface TeacherGroup extends Group {
  students: User[];
  total_students: number;
  active_students: number;
  average_progress: number;
  is_expanded?: boolean;
}

interface StudentStats {
  total_courses: number;
  completed_courses: number;
  average_progress: number;
  last_activity: string | null;
  // New detailed progress fields
  total_lessons: number;
  completed_lessons: number;
  total_steps: number;
  completed_steps: number;
  total_time_spent_minutes: number;
  overall_completion_percentage: number;
}

export default function TeacherClassPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentStats, setStudentStats] = useState<{ [key: string]: StudentStats }>({});
  
  // Bonus Modal State
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [selectedStudentForBonus, setSelectedStudentForBonus] = useState<{id: number, name: string} | null>(null);
  const [defaultBonusAmount, setDefaultBonusAmount] = useState<number>(5);
  
  // Weekly Leaderboard State
  const [groupWeeklyLeaderboard, setGroupWeeklyLeaderboard] = useState<{ [groupId: number]: any[] }>({});
  const [activeTab, setActiveTab] = useState<{ [groupId: number]: 'general' | 'weekly' }>({});
  const [isWeeklyLoading, setIsWeeklyLoading] = useState<{ [groupId: number]: boolean }>({});
  
  // Weekly Awards Hub state
  const [isWeeklyAwardsOpen, setIsWeeklyAwardsOpen] = useState(false);

  const handleOpenBonusModal = (student: User) => {
    setSelectedStudentForBonus({
      id: Number(student.id),
      name: student.name || student.full_name || 'Student'
    });
    setBonusModalOpen(true);
  };

  useEffect(() => {
    loadTeacherGroups();
  }, []);

  const loadTeacherGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const groupsData = await apiClient.getTeacherGroups();
      const teacherGroups = groupsData || [];
      
      const enrichedGroups: TeacherGroup[] = await Promise.all(
        teacherGroups.map(async (group) => {
          try {
            
            const students = group.students || [];
            const statsPromises = students.map(async (student) => {
              try {
                const progressOverview = await apiClient.getStudentProgressOverviewById(student.id.toString());
                
                const stats = {
                  total_courses: progressOverview.total_courses,
                  completed_courses: progressOverview.courses.filter(c => c.completion_percentage >= 100).length,
                  average_progress: progressOverview.overall_completion_percentage,
                  last_activity: null, 
                  total_lessons: progressOverview.total_lessons,
                  completed_lessons: progressOverview.completed_lessons,
                  total_steps: progressOverview.total_steps,
                  completed_steps: progressOverview.completed_steps,
                  total_time_spent_minutes: progressOverview.total_time_spent_minutes,
                  overall_completion_percentage: progressOverview.overall_completion_percentage
                };
                
                return {
                  studentId: student.id,
                  stats
                };
              } catch (error) {
                console.error(`Failed to load stats for student ${student.id}:`, error);
                return {
                  studentId: student.id,
                  stats: {
                    total_courses: 0,
                    completed_courses: 0,
                    average_progress: 0,
                    last_activity: null,
                    total_lessons: 0,
                    completed_lessons: 0,
                    total_steps: 0,
                    completed_steps: 0,
                    total_time_spent_minutes: 0,
                    overall_completion_percentage: 0
                  }
                };
              }
            });
            
            const studentStats = await Promise.all(statsPromises);
            const statsMap = studentStats.reduce((acc, { studentId, stats }) => {
              acc[studentId] = stats;
              return acc;
            }, {} as { [key: string]: StudentStats });
            
            setStudentStats(prev => ({ ...prev, ...statsMap }));
            
            const activeStudents = students.filter(s => s.is_active).length;
            const totalProgress = students.reduce((sum, student) => {
              const stats = statsMap[student.id];
              return sum + (stats?.average_progress || 0);
            }, 0);
            const averageProgress = students.length > 0 ? totalProgress / students.length : 0;
            
            return {
              ...group,
              students,
              total_students: students.length,
              active_students: activeStudents,
              average_progress: averageProgress,
              is_expanded: false
            };
          } catch (error) {
            console.error(`Failed to process group ${group.id}:`, error);
            // Возвращаем группу без студентов, но с ошибкой
            return {
              ...group,
              students: group.students || [],
              total_students: group.students?.length || 0,
              active_students: group.students?.filter(s => s.is_active).length || 0,
              average_progress: 0,
              is_expanded: false
            };
          }
        })
      );
      
      setGroups(enrichedGroups);
    } catch (error) {
      console.error('Failed to load teacher groups:', error);
      setError('Failed to load class data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroupExpansion = (groupId: number) => {
    setGroups(prev => prev.map(group => {
      const isExpanding = group.id === groupId && !group.is_expanded;
      if (isExpanding && !activeTab[groupId]) {
        setActiveTab(prev => ({ ...prev, [groupId]: 'general' }));
      }
      return group.id === groupId 
        ? { ...group, is_expanded: !group.is_expanded }
        : group;
    }));
  };

  const loadWeeklyLeaderboard = async (groupId: number) => {
    if (groupWeeklyLeaderboard[groupId]) return; // Already loaded

    try {
      setIsWeeklyLoading(prev => ({ ...prev, [groupId]: true }));
      const response = await apiClient.getGamificationLeaderboard({ 
        period: 'weekly', 
        group_id: groupId 
      });
      setGroupWeeklyLeaderboard(prev => ({ ...prev, [groupId]: response.entries || [] }));
    } catch (error) {
      console.error(`Failed to load weekly leaderboard for group ${groupId}:`, error);
    } finally {
      setIsWeeklyLoading(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleTabChange = (groupId: number, tab: 'general' | 'weekly') => {
    setActiveTab(prev => ({ ...prev, [groupId]: tab }));
    if (tab === 'weekly') {
      loadWeeklyLeaderboard(groupId);
    }
  };

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.students.some(student => 
      (student.name || student.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalStudents = groups.reduce((sum, group) => sum + group.total_students, 0);
  const totalActiveStudents = groups.reduce((sum, group) => sum + group.active_students, 0);
  const overallAverageProgress = groups.length > 0 
    ? groups.reduce((sum, group) => sum + group.average_progress, 0) / groups.length 
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground flex items-center">
            <GraduationCap className="w-8 h-8 mr-3 text-blue-600" />
            My Class
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and monitor your students</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsWeeklyAwardsOpen(true)}
            variant="outline"
            className="border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary"
          >
            🏆 Weekly Awards
          </Button>
          <Button
            onClick={() => navigate('/teacher/courses')}
            variant="outline"
          >
            Back to Courses
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Groups</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{groups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{totalActiveStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Progress</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{overallAverageProgress.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search groups or students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Groups and Students */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader size="lg" animation="spin" color="#2563eb" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800">Error loading class data</h3>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={loadTeacherGroups}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">No groups found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? 'No groups or students match your search.' : 'You don\'t have any groups assigned yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroupExpansion(group.id)}
                      className="p-0 h-6 w-6"
                    >
                      {group.is_expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {group.total_students} students
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {group.average_progress.toFixed(1)}% avg
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              {group.is_expanded && (
                <CardContent>
                  <div className="flex border-b mb-4">
                    <button
                      onClick={() => handleTabChange(group.id, 'general')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        (activeTab[group.id] || 'general') === 'general'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      General Progress
                    </button>
                    <button
                      onClick={() => handleTabChange(group.id, 'weekly')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab[group.id] === 'weekly'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Weekly Activity
                    </button>
                  </div>

                  {(activeTab[group.id] || 'general') === 'general' ? (
                    group.students.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">No students in this group</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-secondary">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Student
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Overall Progress
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Lessons
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Steps
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Time Spent
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                            {group.students.map((student) => {
                              const stats = studentStats[student.id];
                              return (
                                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-secondary">
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-foreground">
                                        {student.name || student.full_name}
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                                      {student.student_id && (
                                        <div className="text-xs text-gray-400">ID: {student.student_id}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Progress 
                                        value={stats?.overall_completion_percentage || 0} 
                                        className="w-20 h-2"
                                      />
                                      <span className="text-sm font-medium text-gray-900 dark:text-foreground">
                                        {stats?.overall_completion_percentage?.toFixed(1) || 0}%
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {stats?.total_courses || 0} courses
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900 dark:text-foreground">
                                      {stats?.completed_lessons || 0}/{stats?.total_lessons || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {stats?.total_lessons ? ((stats.completed_lessons / stats.total_lessons) * 100).toFixed(1) : 0}% complete
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900 dark:text-foreground">
                                      {stats?.completed_steps || 0}/{stats?.total_steps || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {stats?.completed_steps ? ((stats.completed_steps / stats.total_steps) * 100).toFixed(1) : 0}% complete
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-foreground">
                                      <Clock className="w-4 h-4" />
                                      {stats?.total_time_spent_minutes || 0} min
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {stats?.total_time_spent_minutes ? Math.floor(stats.total_time_spent_minutes / 60) : 0}h {stats?.total_time_spent_minutes ? stats.total_time_spent_minutes % 60 : 0}m
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <Badge variant={student.is_active ? "default" : "secondary"}>
                                      {student.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    /* Weekly View */
                    <div className="space-y-4">
                      {Object.keys(isWeeklyLoading).includes(group.id.toString()) && isWeeklyLoading[group.id] ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                      ) : (!groupWeeklyLeaderboard[group.id] || groupWeeklyLeaderboard[group.id].length === 0) ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-secondary rounded-lg">
                          <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400">No activity recorded for this week yet.</p>
                        </div>
                      ) : (
                        <>
                          {/* Clean Table Layout */}
                          <div className="overflow-hidden border border-gray-100 dark:border-border rounded-lg">
                            <table className="w-full">
                              <thead className="bg-gray-50/50 dark:bg-secondary">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Rank</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Weekly Points</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-border">
                                {groupWeeklyLeaderboard[group.id].map((student, index) => (
                                  <tr key={student.user_id} className="hover:bg-gray-50 dark:hover:bg-secondary transition-colors">
                                    <td className="px-4 py-3 px-6">
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 dark:bg-secondary border border-gray-100 dark:border-border font-medium text-sm text-gray-600 dark:text-gray-400">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-gray-900 dark:text-foreground">{student.user_name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{student.points}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                      
                      <div className="bg-gray-50 dark:bg-secondary p-4 rounded-lg flex items-start gap-3 border border-gray-200 dark:border-border">
                        <Target className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-foreground">Weekly Award Tip</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            This view shows students ranked by points earned since last Monday. 
                            You can reward top performers with extra bonus points to boost motivation!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      {selectedStudentForBonus && (
        <GiveBonusModal
          isOpen={bonusModalOpen}
          onClose={() => setBonusModalOpen(false)}
          studentId={selectedStudentForBonus.id}
          studentName={selectedStudentForBonus.name}
          defaultAmount={defaultBonusAmount}
          onSuccess={() => {
            // Optionally refresh stats or show toast
          }}
        />
      )}

      {/* Weekly Awards Hub */}
      <WeeklyAwardsHub
        isOpen={isWeeklyAwardsOpen}
        onClose={() => setIsWeeklyAwardsOpen(false)}
      />
    </div>
  );
}
