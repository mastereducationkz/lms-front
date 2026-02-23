import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { connectSocket } from '../services/socket';
import apiClient from '../services/api';
import logoIco from '../assets/masteredlogo-ico.ico';
import { 
  Home, 
  BookOpen, 
  ClipboardList,
  ClipboardCheck,
  MessageCircle, 
  UserCheck,
  Settings,
  BookMarked,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  Heart,
  FileText,
  Trophy,
  AlertTriangle,
  Unlock,
  ArrowLeftRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Course } from '../types';

// Navigation items based on user roles
type NavItemTuple = [to: string, label: string, Icon: LucideIcon, badge: number, roles: string[] | null, dataTour?: string];
function getNavigationItems(_userRole: string | undefined, unreadCount: number, unseenGradedCount: number = 0): NavItemTuple[] {
  const allItems: NavItemTuple[] = [
    ['/dashboard', ['head_curator', 'curator'].includes(_userRole || '') ? 'Дашборд' : 'Dashboard', Home, 0, null, 'dashboard-nav'],
    ['/calendar', ['head_curator', 'curator'].includes(_userRole || '') ? 'Календарь' : 'Calendar', Calendar, 0, null, 'calendar-nav'],
    ['/courses', 'My Courses', BookOpen, 0, ['student'], 'courses-nav'],
    ['/homework', _userRole === 'student' ? 'My Homework' : 'Homework', ClipboardList, _userRole === 'student' ? unseenGradedCount : 0, ['student', 'teacher'], 'assignments-nav'],
    ['/favorites', 'My Favorites', Heart, 0, ['student'], 'favorites-nav'],
    ['/teacher/courses', 'My Courses', BookMarked, 0, ['teacher'], 'courses-nav'],
    ['/teacher/class', 'My Class', GraduationCap, 0, ['teacher'], 'students-nav'],
    ['/attendance', 'Attendance', UserCheck, 0, ['teacher'], 'attendance-nav'],
    ['/analytics', ['head_curator', 'curator'].includes(_userRole || '') ? 'Аналитика' : 'Analytics', BarChart3, 0, ['teacher', 'curator', 'admin', 'head_curator'], 'analytics-nav'],
    ['/curator/homeworks', ['head_curator', 'curator'].includes(_userRole || '') ? 'Домашние задания' : 'Homework', FileText, 0, ['curator', 'head_curator'], 'homework-analytics-nav'],
    ['/curator/leaderboard', ['head_curator', 'curator'].includes(_userRole || '') ? 'Лидерборд' : 'Leaderboard', Trophy, 0, ['curator', 'head_curator'], 'leaderboard-nav'],
    ['/curator/tasks', ['head_curator', 'curator'].includes(_userRole || '') ? 'Задачи' : 'Tasks', ClipboardCheck, 0, ['curator', 'head_curator'], 'curator-tasks-nav'],
    ['/curator/students', ['head_curator', 'curator'].includes(_userRole || '') ? 'Журнал' : 'Students', Users, 0, ['curator', 'head_curator'], 'students-journal-nav'],
    ['/admin/courses', 'Manage Courses', BookMarked, 0, ['admin'], 'courses-management'],
    ['/admin/users', 'Manage Users', Users, 0, ['admin'], 'users-management'],
    ['/admin/events', 'Manage Events', Calendar, 0, ['admin'], 'events-management'],
    ['/admin/assignment-zero', 'Assignment Zero', ClipboardCheck, 0, ['admin'], 'assignment-zero-management'],
    ['/admin/question-reports', 'Question Reports', AlertTriangle, 0, ['admin'], 'question-reports-nav'],
    ['/admin/lesson-requests', 'Lesson Requests', ArrowLeftRight, 0, ['admin'], 'lesson-requests-nav'],
    ['/my-requests', 'My Requests', ArrowLeftRight, 0, ['teacher'], 'my-requests-nav'],
    ['/manual-unlocks', 'Manual Unlocks', Unlock, 0, ['teacher'], 'manual-unlocks-nav'],
    ['/chat', ['head_curator', 'curator'].includes(_userRole || '') ? 'Чат' : 'Chat', MessageCircle, unreadCount, null, 'messages-nav'],
  ];

  return allItems;
}

type SidebarVariant = 'desktop' | 'mobile';

interface SidebarProps {
  variant?: SidebarVariant;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ variant = 'desktop', isCollapsed = false, onToggle }: SidebarProps) {
  const [unread, setUnread] = useState(0);
  const [unseenGraded, setUnseenGraded] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCoursesExpanded, setIsCoursesExpanded] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Load unseen graded count for students
  useEffect(() => {
    if (!user || user.role !== 'student') return;
    
    const loadUnseenGradedCount = async () => {
      try {
        const result = await apiClient.getUnseenGradedCount();
        setUnseenGraded(result.count);
      } catch (error) {
        console.warn('Failed to load unseen graded count:', error);
      }
    };
    
    loadUnseenGradedCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnseenGradedCount, 30000);
    return () => clearInterval(interval);
  }, [user]);
  
  useEffect(() => {
    if (!user) return;

    // Connect to socket and load unread count
    const socket = connectSocket();
    
    const loadUnreadCount = () => {
      if (socket.connected) {
        socket.emit('unread:count', (response: { unread_count: number }) => {
          setUnread(response.unread_count || 0);
        });
      }
    };

    // Load initial count
    loadUnreadCount();

    // Listen for unread count updates
    const handleUnreadUpdate = () => {
      loadUnreadCount();
    };

    socket.on('unread:update', handleUnreadUpdate);
    
    // Listen for unseen graded updates
    const handleUnseenGradedUpdate = async () => {
      if (user?.role === 'student') {
        try {
          const result = await apiClient.getUnseenGradedCount();
          setUnseenGraded(result.count);
        } catch (error) {
          console.warn('Failed to update unseen graded count:', error);
        }
      }
    };
    socket.on('unseen_graded:update', handleUnseenGradedUpdate);
    
    // Слушаем событие обновления счетчика (для совместимости)
    const handleUpdateUnreadCount = () => {
      loadUnreadCount();
    };
    window.addEventListener('updateUnreadCount', handleUpdateUnreadCount);
    
    return () => {
      socket.off('unread:update', handleUnreadUpdate);
      socket.off('unseen_graded:update', handleUnseenGradedUpdate);
      window.removeEventListener('updateUnreadCount', handleUpdateUnreadCount);
    };
  }, [user]);

  // Load courses when expanding
  const loadCourses = async () => {
    if (courses.length > 0) return; // Already loaded
    
    setIsLoadingCourses(true);
    try {
      // Use dedicated my-courses endpoint for students, general endpoint for others
      const coursesData = user?.role === 'student' 
        ? await apiClient.getMyCourses()
        : await apiClient.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleCoursesToggle = () => {
    if (isCollapsed) {
      // If collapsed, navigate to courses page instead of expanding
      navigate(user?.role === 'teacher' ? '/teacher/courses' : '/courses');
      return;
    }
    setIsCoursesExpanded(!isCoursesExpanded);
    if (!isCoursesExpanded) {
      loadCourses();
    }
  };

  const handleLogout = () => {
    logout();
  };

  const wrapperClass = variant === 'desktop'
    ? `hidden lg:flex ${isCollapsed ? 'w-20 p-2' : 'w-64 p-4 sm:p-6'} h-screen fixed top-0 left-0 bg-white dark:bg-card border-r border-border flex-col transition-all duration-300`
    : 'flex w-64 h-full bg-white dark:bg-card border-r border-border p-4 sm:p-6 flex-col';

  return (
    <aside className={wrapperClass}>
      <div className={`flex items-center mb-6 sm:mb-8 ${isCollapsed ? 'justify-center flex-col gap-2' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <img src={logoIco} alt="Master Education" className="w-7 h-7 sm:w-8 sm:h-8 rounded" />
          {!isCollapsed && (
            <div className="ml-3 leading-tight">
              <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white -mt-1">Master Education</div>
            </div>
          )}
        </div>
        {variant === 'desktop' && onToggle && (
          <button 
            onClick={onToggle} 
            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary text-gray-500 dark:text-gray-400 transition-colors ${isCollapsed ? '' : 'ml-auto'}`}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>
      
      <nav className="flex flex-col space-y-1 flex-1">
        {getNavigationItems(user?.role, unread, unseenGraded).map(([to, label, Icon, badge, roles, dataTour]) => {
          // Skip items if user doesn't have required role
          if (roles && (!user?.role || !roles.includes(user.role))) return null;
          
          // Handle expandable My Courses
          if ((to === '/courses' && user?.role === 'student') || (to === '/teacher/courses' && user?.role === 'teacher')) {
            return (
              <div key={to} data-tour={dataTour}>
                {/* Main Courses Button */}
                <button
                  onClick={handleCoursesToggle}
                  className={`w-full flex items-center rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary transition-colors py-3 text-base lg:py-2 lg:text-sm ${isCollapsed ? 'justify-center px-2' : 'px-5 lg:px-4'}`}
                >
                  <Icon className={`w-6 h-6 lg:w-5 lg:h-5 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-gray-800 dark:text-gray-200 text-base lg:text-sm text-left">{label}</span>
                      {badge > 0 && (
                        <span className="ml-2 text-xs bg-red-600 text-white rounded-full px-2 py-0.5">{badge}</span>
                      )}
                      <ChevronRight className={`w-4 h-4 ml-2 transition-transform ${isCoursesExpanded ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
                
                {/* Expanded Courses List */}
                {isCoursesExpanded && !isCollapsed && (
                  <div className="ml-6 mt-1 space-y-1">
                    {isLoadingCourses ? (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{['head_curator', 'curator'].includes(user?.role || '') ? 'Загрузка курсов...' : 'Loading courses...'}</div>
                    ) : courses.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{['head_curator', 'curator'].includes(user?.role || '') ? 'Курсы не найдены' : 'No courses found'}</div>
                    ) : (
                      courses.slice(0, 5).map((course) => (
                        <NavLink
                          key={course.id}
                          to={`/course/${course.id}`}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-secondary transition-colors px-3 py-2 text-sm ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500' : ''}`
                          }
                        >
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="truncate">{course.title}</span>
                        </NavLink>
                      ))
                    )}
                    {courses.length > 5 && (
                      <NavLink
                        to={user?.role === 'teacher' ? '/teacher/courses' : '/courses'}
                        className="flex items-center rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors px-3 py-2 text-sm font-medium"
                      >
                        <span>{['head_curator', 'curator'].includes(user?.role || '') ? `Все курсы (${courses.length})` : `View all courses (${courses.length})`}</span>
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            );
          }
          
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/courses' || to === '/teacher/courses'}
              data-tour={dataTour}
              className={({ isActive }) =>
                `flex items-center rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary transition-colors 
                 py-3 text-base lg:py-2 lg:text-sm ${isActive ? 'nav-link-active' : ''} ${isCollapsed ? 'justify-center px-2' : 'px-5 lg:px-4'}`
              }
            >
              <Icon className={`w-6 h-6 lg:w-5 lg:h-5 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-gray-800 dark:text-gray-200 text-base lg:text-sm">{label}</span>
                  {badge > 0 && (
                    <span className="ml-2 text-xs bg-red-600 text-white rounded-full px-2 py-0.5">{badge}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        }).filter(Boolean)}
      </nav>
      
      <div className="mt-auto pt-6 border-t dark:border-border">
        <div className="relative" data-tour="profile-nav">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors`}
          >
            <div className="flex items-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </div>
              {!isCollapsed && (
                <div className="ml-3 text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{user?.name || 'User'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'head_curator' ? 'Руководитель кураторов' : user?.role === 'curator' ? 'Куратор' : (user?.role || 'Unknown')}</div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          
          {isDropdownOpen && (
            <div className={`absolute bottom-full ${isCollapsed ? 'left-full ml-2 w-48' : 'left-0 right-0 w-full'} mb-2 bg-white dark:bg-card border border-border rounded-lg shadow-lg py-2 z-50`}>
              <NavLink
                to="/profile"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-3" />
                {['head_curator', 'curator'].includes(user?.role || '') ? 'Профиль' : 'Profile'}
              </NavLink>
              <NavLink
                to="/settings"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
              >
                <Settings className="w-4 h-4 mr-3" />
                {['head_curator', 'curator'].includes(user?.role || '') ? 'Настройки' : 'Settings'}
              </NavLink>
              <div className="border-t dark:border-gray-700 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                {['head_curator', 'curator'].includes(user?.role || '') ? 'Выйти' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function SidebarDesktop({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  return <Sidebar variant="desktop" isCollapsed={isCollapsed} onToggle={onToggle} />;
}

interface SidebarMobileProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarMobile({ open, onClose }: SidebarMobileProps) {
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute top-0 left-0 w-64 h-full bg-white dark:bg-card border-r border-border p-0">
        <Sidebar variant="mobile" />
      </div>
    </div>
  );
}
