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

/** Only three groups: primary nav, curator tools, admin tools */
type NavCategory = 'primary' | 'curator' | 'admin';

const CATEGORY_ORDER: NavCategory[] = ['primary', 'curator', 'admin'];

const getCategoryLabels = (isRu: boolean): Record<NavCategory, string> =>
  isRu
    ? {
        primary: 'ОСНОВНОЕ',
        curator: 'КУРАТОРСТВО',
        admin: 'АДМИН',
      }
    : {
        primary: 'MAIN',
        curator: 'CURATOR',
        admin: 'ADMIN',
      };

// Navigation items: optional 7th field = category (defaults to primary)
type NavItemTuple = [
  to: string,
  label: string,
  Icon: LucideIcon,
  badge: number,
  roles: string[] | null,
  dataTour?: string,
  category?: NavCategory,
];

function getNavigationItems(
  _userRole: string | undefined,
  unreadCount: number,
  unseenGradedCount: number = 0,
  isSpecialGroupStudent: boolean = false
): NavItemTuple[] {
  const allItems: NavItemTuple[] = [
    ['/dashboard', ['head_curator', 'curator'].includes(_userRole || '') ? 'Дашборд' : 'Dashboard', Home, 0, null, 'dashboard-nav', 'primary'],
    ['/calendar', ['head_curator', 'curator'].includes(_userRole || '') ? 'Календарь' : 'Calendar', Calendar, 0, null, 'calendar-nav', 'primary'],
    ['/courses', 'My Courses', BookOpen, 0, ['student'], 'courses-nav', 'primary'],
    ['/homework', _userRole === 'student' ? 'My Homework' : 'Homework', ClipboardList, _userRole === 'student' ? unseenGradedCount : 0, ['student', 'teacher'], 'assignments-nav', 'primary'],
    ['/favorites', 'My Favorites', Heart, 0, ['student'], 'favorites-nav', 'primary'],
    ['/teacher/courses', 'My Courses', BookMarked, 0, ['teacher'], 'courses-nav', 'primary'],
    ['/teacher/class', 'My Class', GraduationCap, 0, ['teacher'], 'students-nav', 'primary'],
    ['/attendance', 'Attendance', UserCheck, 0, ['teacher'], 'attendance-nav', 'primary'],
    ['/analytics', ['head_curator', 'curator'].includes(_userRole || '') ? 'Аналитика' : 'Analytics', BarChart3, 0, ['teacher', 'curator', 'admin', 'head_curator'], 'analytics-nav', 'primary'],
    ['/curator/homeworks', ['head_curator', 'curator'].includes(_userRole || '') ? 'Домашние задания' : 'Homework', FileText, 0, ['curator', 'head_curator'], 'homework-analytics-nav', 'curator'],
    ['/curator/leaderboard', ['head_curator', 'curator'].includes(_userRole || '') ? 'Лидерборд' : 'Leaderboard', Trophy, 0, ['curator', 'head_curator'], 'leaderboard-nav', 'curator'],
    ['/curator/tasks', ['head_curator', 'curator'].includes(_userRole || '') ? 'Задачи' : 'Tasks', ClipboardCheck, 0, ['curator', 'head_curator'], 'curator-tasks-nav', 'curator'],
    ['/curator/exam-results', ['head_curator', 'curator'].includes(_userRole || '') ? 'Результаты экзаменов' : 'Exam results', ClipboardCheck, 0, ['curator', 'head_curator'], 'curator-exam-results-nav', 'curator'],
    ['/curator/students', ['head_curator', 'curator'].includes(_userRole || '') ? 'Журнал' : 'Students', Users, 0, ['curator', 'head_curator'], 'students-journal-nav', 'curator'],
    ['/admin/courses', 'Manage Courses', BookMarked, 0, ['admin'], 'courses-management', 'admin'],
    ['/admin/users', 'Manage Users', Users, 0, ['admin'], 'users-management', 'admin'],
    ['/admin/events', 'Manage Events', Calendar, 0, ['admin'], 'events-management', 'admin'],
    ['/exam-results', 'Exam Results', ClipboardCheck, 0, ['admin', 'head_curator', 'head_teacher'], 'exam-results-tracking-nav', 'admin'],
    ['/admin/question-reports', 'Question Reports', AlertTriangle, 0, ['admin'], 'question-reports-nav', 'admin'],
    ['/admin/lesson-requests', 'Lesson Requests', ArrowLeftRight, 0, ['admin'], 'lesson-requests-nav', 'admin'],
    ['/my-requests', 'My Requests', ArrowLeftRight, 0, ['teacher'], 'my-requests-nav', 'primary'],
    ['/manual-unlocks', 'Manual Unlocks', Unlock, 0, ['teacher'], 'manual-unlocks-nav', 'primary'],
    ['/chat', ['head_curator', 'curator'].includes(_userRole || '') ? 'Чат' : 'Chat', MessageCircle, unreadCount, null, 'messages-nav', 'primary'],
  ];

  if (_userRole === 'student' && isSpecialGroupStudent) {
    return allItems.filter(([to]) => to !== '/calendar' && to !== '/homework');
  }

  return allItems;
}

type NavSection = { category: NavCategory; label: string; items: NavItemTuple[] };

function buildNavSections(items: NavItemTuple[], userRole: string | undefined): NavSection[] {
  const labels = getCategoryLabels(['head_curator', 'curator'].includes(userRole || ''));
  const byCat = new Map<NavCategory, NavItemTuple[]>();
  for (const cat of CATEGORY_ORDER) byCat.set(cat, []);

  for (const tuple of items) {
    const cat = (tuple[6] as NavCategory | undefined) ?? 'primary';
    const list = byCat.get(cat);
    if (list) list.push(tuple);
  }

  return CATEGORY_ORDER.filter((cat) => (byCat.get(cat)?.length ?? 0) > 0).map((category) => ({
    category,
    label: labels[category],
    items: byCat.get(category)!,
  }));
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
  const [isSpecialGroupStudent, setIsSpecialGroupStudent] = useState(false);
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
    const loadSpecialGroupsState = async () => {
      if (user?.role !== 'student') {
        setIsSpecialGroupStudent(false);
        return;
      }

      try {
        const myGroups = await apiClient.getMyGroups();
        const hasOnlySpecialGroups = myGroups.length > 0 && myGroups.every(group => group.is_special);
        setIsSpecialGroupStudent(hasOnlySpecialGroups);
      } catch (error) {
        console.warn('Failed to load special group flags:', error);
        setIsSpecialGroupStudent(false);
      }
    };

    loadSpecialGroupsState();
  }, [user?.id, user?.role]);
  
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
    ? `hidden lg:flex ${isCollapsed ? 'w-20 p-2' : 'w-64 p-4 sm:p-5'} h-screen fixed top-0 left-0 bg-white dark:bg-card border-r border-border flex-col transition-all duration-300`
    : 'flex w-64 h-full bg-white dark:bg-card border-r border-border p-4 sm:p-5 flex-col';

  return (
    <aside className={wrapperClass}>
      <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center flex-col gap-2' : ''}`}>
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
      
      <nav className="flex flex-col flex-1 overflow-y-auto min-h-0 pt-1">
        {buildNavSections(
          getNavigationItems(user?.role, unread, unseenGraded, isSpecialGroupStudent),
          user?.role
        )
          .map((section) => ({
            ...section,
            items: section.items.filter((tuple) => {
              const roles = tuple[4];
              return !roles || !!(user?.role && roles.includes(user.role));
            }),
          }))
          .filter((section) => section.items.length > 0)
          .map((section, sectionIndex) => (
            <div key={section.category} className={sectionIndex > 0 ? 'mt-3.5' : ''}>
              {!isCollapsed && section.category !== 'primary' && (
                <div className="px-4 lg:px-4 mb-1.5 pt-0.5">
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 dark:text-gray-500 uppercase">
                    {section.label}
                  </span>
                </div>
              )}
              {isCollapsed && sectionIndex > 0 && (
                <div className="mx-2 my-2 h-px bg-gray-200 dark:bg-gray-700 shrink-0" aria-hidden />
              )}
              <div className="flex flex-col gap-1">
                {section.items.map(([to, label, Icon, badge, , dataTour]) => {
                  // Handle expandable My Courses
                  if ((to === '/courses' && user?.role === 'student') || (to === '/teacher/courses' && user?.role === 'teacher')) {
                    return (
                      <div key={to} data-tour={dataTour}>
                        <button
                          type="button"
                          onClick={handleCoursesToggle}
                          className={`w-full flex items-center rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary transition-colors py-2.5 text-sm leading-snug ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 min-w-0 text-gray-800 dark:text-gray-200 text-sm text-left">{label}</span>
                              {badge > 0 && (
                                <span className="ml-2 text-xs bg-red-600 text-white rounded-full px-2 py-0.5">{badge}</span>
                              )}
                              <ChevronRight className={`w-4 h-4 ml-1 shrink-0 transition-transform ${isCoursesExpanded ? 'rotate-90' : ''}`} />
                            </>
                          )}
                        </button>

                        {isCoursesExpanded && !isCollapsed && (
                          <div className="ml-5 mt-1 space-y-0.5">
                            {isLoadingCourses ? (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{['head_curator', 'curator'].includes(user?.role || '') ? 'Загрузка курсов...' : 'Loading courses...'}</div>
                            ) : courses.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{['head_curator', 'curator'].includes(user?.role || '') ? 'Курсы не найдены' : 'No courses found'}</div>
                            ) : (
                              courses.slice(0, 5).map((course) => (
                                <NavLink
                                  key={course.id}
                                  to={`/course/${course.id}`}
                                  className={({ isActive }) =>
                                    `flex items-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-secondary transition-colors px-3 py-2 text-sm leading-snug ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500' : ''}`
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
                 py-2.5 text-sm leading-snug ${isActive ? 'nav-link-active' : ''} ${isCollapsed ? 'justify-center px-2' : 'px-4'}`
                      }
                    >
                      <Icon className={`w-5 h-5 shrink-0 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 min-w-0 text-gray-800 dark:text-gray-200 text-sm">{label}</span>
                          {badge > 0 && (
                            <span className="ml-2 text-xs bg-red-600 text-white rounded-full px-2 py-0.5">{badge}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>
      
      <div className="mt-auto pt-4 border-t dark:border-border">
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
