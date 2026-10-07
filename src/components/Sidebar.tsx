import { useEffect, useMemo, useState } from 'react';
import { KasatikCoachmark } from '@/components/mascot/KasatikSpotlight';
import UserAvatar from '@/components/mascot/UserAvatar';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { connectSocket } from '../services/socket';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import apiClient from '../services/api';
import logoIco from '../assets/masteredlogo-ico.ico';
import { CRM_ONBOARDING_URL, CRM_TASKS_URL, CRM_WORKSPACE_URL } from '../lib/crmLinks';
import { attendanceBadge, type AttendanceBadgeTone, type AttendanceDue } from '../lib/attendanceBadge';
import { 
  ExternalLink,
  Home, 
  BookOpen, 
  ClipboardList,
  ClipboardCheck,
  ListChecks,
  UserPlus,
  MessageCircle,
  UserCheck,
  Settings,
  BookMarked,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Users,
  UsersRound,
  GraduationCap,
  Calendar,
  BarChart3,
  Heart,
  FileText,
  Trophy,
  AlertTriangle,
  Unlock,
  ArrowLeftRight,
  Timer,
  Headset,
  Presentation,
  Video,
  Megaphone,
  MonitorCheck,
  MonitorPlay,
  Paperclip,
  Route,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Course } from '../types';
import { roleLabel } from '@/lib/roleLabel';
import { replayTourFor } from '@/lib/guide/state';
import { requestTourReplay } from '@/components/guide/tourStore';
import { useT } from '@/lib/i18n/react';
import type { TFunction } from '@/lib/i18n';
import '@/lib/i18n/catalogs/shell';
import '@/lib/i18n/catalogs/guide';

/** Only three groups: primary nav, curator tools, admin tools */
type NavCategory = 'primary' | 'curator' | 'admin';

const CATEGORY_ORDER: NavCategory[] = ['primary', 'curator', 'admin'];

const getCategoryLabels = (t: TFunction): Record<NavCategory, string> => ({
  primary: t('shell.nav.sectionPrimary'),
  curator: t('shell.nav.sectionCurator'),
  admin: t('shell.nav.sectionAdmin'),
});

// Navigation items: optional 7th field = category (defaults to primary),
// optional 8th = show a "Soon" pill for a feature that is announced but not open yet,
// optional 9th = badge tone (defaults to the red "act now" pill),
// optional 10th = the badge's tooltip.
type NavItemTuple = [
  to: string,
  label: string,
  Icon: LucideIcon,
  badge: number,
  roles: string[] | null,
  dataTour?: string,
  category?: NavCategory,
  comingSoon?: boolean,
  badgeTone?: AttendanceBadgeTone,
  badgeTitle?: string | null,
];

/** Red is "you can do this now"; amber is "waiting on Google Meet, nothing to do yet". Every
 *  other badge in the sidebar is a plain count and stays red. */
function badgeToneClass(tone?: AttendanceBadgeTone): string {
  return tone === 'waiting'
    ? 'bg-amber-500 text-white'
    : 'bg-red-600 text-white';
}

function getNavigationItems(
  t: TFunction,
  _userRole: string | undefined,
  unreadCount: number,
  unseenGradedCount: number = 0,
  isSpecialGroupStudent: boolean = false,
  lessonRequestCount: number = 0,
  attendanceDue?: AttendanceDue
): NavItemTuple[] {
  // Muted while Google Meet still owes us the call, red the moment the register can actually
  // be taken — see lib/attendanceBadge.
  const attendance = attendanceBadge(attendanceDue);
  const allItems: NavItemTuple[] = [
    ['/dashboard', t('shell.nav.dashboard'), Home, 0, null, 'dashboard-nav', 'primary'],
    ['/calendar', t('shell.nav.calendar'), Calendar, 0, null, 'calendar-nav', 'primary'],
    ['/recordings', t('shell.nav.lessonRecordings'), Video, 0, null, 'recordings-nav', 'primary'],
    ['/webinar-recordings', t('shell.nav.webinarRecordings'), MonitorPlay, 0, null, 'webinar-recordings-nav', 'primary'],
    ['/materials', t('shell.nav.materials'), Paperclip, 0, ['student', 'teacher', 'curator', 'head_curator', 'head_teacher', 'admin'], 'materials-nav', 'primary'],
    // Who was in each lesson's Meet room. Teachers see their lessons, curators their groups' — the
    // backend scopes it; students never (the record is about marks, which are staff business).
    ['/meet-attendance', t('shell.nav.meetAttendance'), MonitorCheck, 0, ['admin', 'head_curator', 'head_teacher', 'teacher', 'curator'], 'meet-attendance-nav', 'primary'],
    // Lateness, missed lessons and their fines. A teacher sees only their own row.
    ['/teacher-discipline', t(_userRole === 'teacher' ? 'shell.nav.myDiscipline' : 'shell.nav.teacherDiscipline'), ClipboardCheck, 0, ['admin', 'head_teacher', 'teacher'], 'teacher-discipline-nav', 'primary'],
    ['/courses', t('shell.nav.myCourses'), BookOpen, 0, ['student'], 'courses-nav', 'primary'],
    // Read-only catalog of every published course (2026-10-03); replaced the teacher's /teacher/courses.
    ['/courses', t('shell.nav.courses'), BookOpen, 0, ['teacher', 'curator', 'head_curator'], 'courses-nav', 'primary'],
    ['/homework', t(_userRole === 'student' ? 'shell.nav.myHomework' : 'shell.nav.homework'), ClipboardList, _userRole === 'student' ? unseenGradedCount : 0, ['student', 'teacher'], 'assignments-nav', 'primary'],
    ['/favorites', t('shell.nav.favorites'), Heart, 0, ['student'], 'favorites-nav', 'primary'],
    // Kasatik Achievements (2026-10-04): badges that unlock new orca items.
    ['/achievements', t('shell.nav.achievements'), Trophy, 0, ['student'], 'achievements-nav', 'primary'],
    ['/teacher/class', t('shell.nav.myClass'), GraduationCap, 0, ['teacher'], 'students-nav', 'primary'],
    ['/attendance', t('shell.nav.attendance'), UserCheck, attendance.count, ['teacher', 'head_teacher', 'head_curator'], 'attendance-nav', 'primary', false, attendance.tone, attendance.title],
    ['/analytics', t('shell.nav.analytics'), BarChart3, 0, ['teacher', 'curator', 'admin', 'head_curator', 'head_teacher'], 'analytics-nav', 'primary'],
    // How students earn their Kasatik rewards, school-wide (2026-10-04). Teachers and curators see their groups under the leaderboard.
    ['/admin/achievements', t('shell.nav.achievements'), Trophy, 0, ['admin', 'head_curator', 'head_teacher'], 'achievements-analytics-nav', 'primary'],
    ['/review', t('shell.nav.quizReview'), Presentation, 0, ['teacher', 'curator', 'admin', 'head_curator', 'head_teacher'], 'quiz-review-nav', 'primary'],
    ['/curator/homeworks', t('shell.nav.homework'), FileText, 0, ['curator', 'head_curator'], 'homework-analytics-nav', 'curator'],
    ['/curator/leaderboard', t('shell.nav.leaderboard'), Trophy, 0, ['curator', 'head_curator'], 'leaderboard-nav', 'curator'],
    // Curator tasks («Задачи») live in the CRM. Linked directly rather than through the in-app
    // redirect so curators land on the list in one hop; /curator/tasks and /curator/onboarding
    // still redirect, which is what catches existing bookmarks.
    [CRM_TASKS_URL, t('shell.nav.crmTasks'), ListChecks, 0, ['curator', 'head_curator'], 'curator-tasks-nav', 'curator'],
    [CRM_ONBOARDING_URL, t('shell.nav.crmOnboarding'), UserPlus, 0, ['curator', 'head_curator'], 'curator-onboarding-nav', 'curator'],
    [CRM_WORKSPACE_URL, t('shell.nav.backToCrm'), ExternalLink, 0, ['curator', 'head_curator'], 'crm-workspace-nav', 'curator'],
    ['/curator/students', t('shell.nav.studentsJournal'), Users, 0, ['curator', 'head_curator', 'admin', 'head_teacher'], 'students-journal-nav', 'curator'],
    ['/curator/groups', t('shell.nav.myGroups'), UsersRound, 0, ['curator', 'head_curator'], 'curator-groups-nav', 'curator'],
    ['/admin/courses', t('shell.nav.manageCourses'), BookMarked, 0, ['admin', 'head_teacher'], 'courses-management', 'admin'],
    ['/admin/users', t('shell.nav.manageUsers'), Users, 0, ['admin', 'head_curator'], 'users-management', 'admin'],
    ['/admin/weekly-top-students', t('shell.nav.weeklyTopStudents'), Trophy, 0, ['admin'], 'weekly-top-students-nav', 'admin'],
    ['/admin/announcements', t('shell.nav.announcements'), Megaphone, 0, ['admin', 'head_curator', 'head_teacher'], 'announcements-nav', 'admin'],
    ['/admin/checkpoints', t('shell.nav.satCheckpoints'), ClipboardCheck, 0, ['admin', 'head_curator', 'head_teacher', 'teacher', 'curator'], 'checkpoints-admin-nav', 'admin'],
    ['/admin/events', t('shell.nav.manageEvents'), Calendar, 0, ['admin', 'head_teacher'], 'events-management', 'admin'],
    ['/admin/recordings', t('shell.nav.recordingsRollout'), Video, 0, ['admin', 'head_curator', 'head_teacher'], 'recordings-admin-nav', 'admin'],
    ['/exam-results', t('shell.nav.examResults'), ClipboardCheck, 0, ['teacher', 'curator', 'head_curator', 'head_teacher', 'admin'], 'exam-results-nav', 'primary'],
    ['/bluebook-results', t('shell.nav.bluebookResults'), ClipboardCheck, 0, ['teacher', 'curator', 'head_curator', 'head_teacher', 'admin'], 'bluebook-results-nav', 'primary'],
    ['/admin/question-reports', t('shell.nav.questionReports'), AlertTriangle, 0, ['admin', 'head_teacher'], 'question-reports-nav', 'admin'],
    ['/curator/homeworks', t('shell.nav.homework'), FileText, 0, ['head_teacher'], 'head-homework-nav', 'primary'],
    ['/curator/leaderboard', t('shell.nav.leaderboard'), Trophy, 0, ['head_teacher'], 'head-leaderboard-nav', 'primary'],
    ['/head-teacher/lesson-requests', t('shell.nav.lessonRequests'), ArrowLeftRight, lessonRequestCount, ['head_teacher', 'head_curator'], 'head-lesson-requests-nav', 'primary'],
    ['/admin/lesson-requests', t('shell.nav.lessonRequests'), ArrowLeftRight, lessonRequestCount, ['admin'], 'lesson-requests-nav', 'admin'],
    ['/my-requests', t('shell.nav.myRequests'), ArrowLeftRight, lessonRequestCount, ['teacher'], 'my-requests-nav', 'primary'],
    ['/manual-unlocks', t('shell.nav.manualUnlocks'), Unlock, 0, ['teacher', 'head_teacher'], 'manual-unlocks-nav', 'primary'],
    ['/trial-access', t('shell.nav.trialAccess'), Timer, 0, ['admin', 'head_curator'], 'trial-access-nav', 'admin'],
    ['/chat', t('shell.nav.chat'), MessageCircle, unreadCount, null, 'messages-nav', 'primary'],
    ['https://support.mastereducation.kz', t('shell.nav.support'), Headset, 0, null, 'support-nav', 'primary'],
  ];

  if (_userRole === 'student' && isSpecialGroupStudent) {
    // These students have no calendar, so a lesson-recordings or materials entry would only
    // lead them to lessons they cannot see.
    return allItems.filter(
      ([to]) => to !== '/calendar' && to !== '/homework' && to !== '/recordings' && to !== '/materials'
        && to !== '/webinar-recordings'
    );
  }

  return allItems;
}

type NavSection = { category: NavCategory; label: string; items: NavItemTuple[] };

function buildNavSections(items: NavItemTuple[], t: TFunction): NavSection[] {
  const labels = getCategoryLabels(t);
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
  /** The mobile drawer closes itself, e.g. so a replayed tour isn't hidden behind it. */
  onClose?: () => void;
}

export default function Sidebar({ variant = 'desktop', isCollapsed = false, onToggle, onClose }: SidebarProps) {
  const [unread, setUnread] = useState(0);
  const [unseenGraded, setUnseenGraded] = useState(0);
  const [lessonRequestCount, setLessonRequestCount] = useState(0);
  const [attendanceDue, setAttendanceDue] = useState<AttendanceDue | undefined>(undefined);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCoursesExpanded, setIsCoursesExpanded] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [groupsSpecialChecked, setGroupsSpecialChecked] = useState<boolean | null>(null);
  const { user, logout } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const replayKind = replayTourFor(user?.role);

  // Hide restricted student nav items until role-specific special-group state is resolved.
  const hideRestrictedStudentNav = useMemo(() => {
    if (!user || user.role !== 'student') return false
    if (user.special_group_only_student === true || groupsSpecialChecked === true) return true
    if (
      user.special_group_only_student === undefined &&
      groupsSpecialChecked === null
    ) return true
    return false
  }, [user, groupsSpecialChecked]);
  
  // Load unseen graded count for students. Polls only while the tab is visible (see hook).
  useVisiblePolling(
    () => {
      apiClient.getUnseenGradedCount()
        .then((result) => setUnseenGraded(result.count))
        .catch((error) => console.warn('Failed to load unseen graded count:', error));
    },
    60000,
    !!user && user.role === 'student',
  );

  // Pending lesson-request count for the sidebar badge. Teacher: their own requests still awaiting
  // a decision. Head teacher / admin: requests awaiting their approval. Visible-tab polling only.
  useVisiblePolling(
    () => {
      if (!user) return;
      const req = user.role === 'teacher'
        ? apiClient.getMyLessonRequests('pending')
        : apiClient.getPendingLessonRequests();
      req
        .then((reqs) => setLessonRequestCount(reqs.length))
        .catch((error) => console.warn('Failed to load lesson request count:', error));
    },
    60000,
    !!user && ['teacher', 'head_teacher', 'head_curator', 'admin'].includes(user.role),
  );

  // Registers this person still owes. The dashboard card only nags a teacher who happens to be
  // on the dashboard; a teacher who goes off to check the Meet room never sees it again. Polled
  // like the others — which also means the badge turns actionable within a minute of Meet's data
  // landing, wherever they happen to be.
  useVisiblePolling(
    () => {
      apiClient.getAttendanceDue()
        .then(setAttendanceDue)
        .catch((error) => console.warn('Failed to load attendance due count:', error));
    },
    60000,
    !!user && ['teacher', 'head_teacher', 'head_curator'].includes(user.role),
  );

  useEffect(() => {
    const loadSpecialGroupsState = async () => {
      if (user?.role !== 'student') {
        setGroupsSpecialChecked(null);
        return;
      }

      if (user.special_group_only_student === true) {
        setGroupsSpecialChecked(true)
        return
      }

      try {
        const myGroups = await apiClient.getMyGroups();
        const hasOnlySpecialGroups = myGroups.length > 0 && myGroups.every(group => group.is_special);
        setGroupsSpecialChecked(hasOnlySpecialGroups);
      } catch (error) {
        console.warn('Failed to load special group flags:', error);
        setGroupsSpecialChecked(false);
      }
    };

    loadSpecialGroupsState();
  }, [user?.id, user?.role, user?.special_group_only_student]);
  
  // Keyed on who is signed in (and their role, which the graded-count handler reads): a profile
  // edit hands out a new user object and must not re-ask and re-subscribe.
  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (!userId) return;

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
      if (userRole === 'student') {
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
  }, [userId, userRole]);

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
      navigate('/courses');
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
    ? `hidden lg:flex ${isCollapsed ? 'w-20 p-2' : 'w-64 p-4 sm:p-5'} h-screen fixed top-0 left-0 bg-card border-r border-border flex-col transition-all duration-300`
    : 'flex w-64 h-full bg-card border-r border-border p-4 sm:p-5 flex-col';

  return (
    <aside className={wrapperClass}>
      <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center flex-col gap-2' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <img src={logoIco} alt="Master Education" className="w-7 h-7 sm:w-8 sm:h-8 rounded" />
          {!isCollapsed && (
            <div className="ml-3 leading-tight">
              <div className="text-base sm:text-lg font-semibold text-foreground -mt-1">Master Education</div>
            </div>
          )}
        </div>
        {variant === 'desktop' && onToggle && (
          <button 
            onClick={onToggle} 
            className={`p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors ${isCollapsed ? '' : 'ml-auto'}`}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>
      
      <nav className="flex flex-col flex-1 overflow-y-auto min-h-0 pt-1">
        {buildNavSections(
          getNavigationItems(t, user?.role, unread, unseenGraded, hideRestrictedStudentNav, lessonRequestCount, attendanceDue),
          t
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
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 dark:text-muted-foreground uppercase">
                    {section.label}
                  </span>
                </div>
              )}
              {isCollapsed && sectionIndex > 0 && (
                <div className="mx-2 my-2 h-px bg-gray-200 dark:bg-border shrink-0" aria-hidden />
              )}
              <div className="flex flex-col gap-1">
                {section.items.map(([to, label, Icon, badge, , dataTour, , comingSoon, badgeTone, badgeTitle]) => {
                  // Handle expandable My Courses
                  if (to === '/courses' && user?.role === 'student') {
                    return (
                      <div key={to} data-tour={dataTour}>
                        <button
                          type="button"
                          onClick={handleCoursesToggle}
                          className={`w-full flex items-center rounded-xl text-gray-700 dark:text-foreground hover:bg-muted transition-colors py-2.5 text-sm leading-snug ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 min-w-0 text-foreground text-sm text-left">{label}</span>
                              {badge > 0 && (
                                <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${badgeToneClass(badgeTone)}`} title={badgeTitle ?? undefined}>{badge}</span>
                              )}
                              <ChevronRight className={`w-4 h-4 ml-1 shrink-0 transition-transform ${isCoursesExpanded ? 'rotate-90' : ''}`} />
                            </>
                          )}
                        </button>

                        {isCoursesExpanded && !isCollapsed && (
                          <div className="ml-5 mt-1 space-y-0.5">
                            {isLoadingCourses ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">{t('shell.nav.loadingCourses')}</div>
                            ) : courses.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">{t('shell.nav.noCourses')}</div>
                            ) : (
                              courses.slice(0, 5).map((course) => (
                                <NavLink
                                  key={course.id}
                                  to={`/course/${course.id}`}
                                  className={({ isActive }) =>
                                    `flex items-center rounded-lg hover:bg-muted transition-colors px-3 py-2 text-sm leading-snug ${isActive ? 'nav-link-active text-foreground' : 'text-muted-foreground'}`
                                  }
                                >
                                  {({ isActive }) => (
                                    <>
                                      {/* the dot is this row's icon: like the top-level icons, blue in dark only when active */}
                                      <div className={`w-2 h-2 bg-blue-400 rounded-full mr-3 flex-shrink-0 ${isActive ? 'dark:bg-brand' : 'dark:bg-muted-foreground'}`}></div>
                                      <span className="truncate">{course.title}</span>
                                    </>
                                  )}
                                </NavLink>
                              ))
                            )}
                            {courses.length > 5 && (
                              <NavLink
                                to="/courses"
                                className="flex items-center rounded-lg text-brand hover:bg-brand-surface transition-colors px-3 py-2 text-sm font-medium"
                              >
                                <span>{t('shell.nav.allCourses', { count: courses.length })}</span>
                              </NavLink>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // External links (e.g. the standalone Support platform) render as a plain
                  // anchor opening in a new tab, but keep the same structure/classes as the
                  // internal NavLink items so they're visually identical.
                  if (to.startsWith('http')) {
                    return (
                      <a
                        key={to}
                        href={to}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-tour={dataTour}
                        className={`flex items-center rounded-xl text-gray-700 dark:text-foreground hover:bg-muted transition-colors py-2.5 text-sm leading-snug ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 min-w-0 text-foreground text-sm">{label}</span>
                            {badge > 0 && (
                              <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${badgeToneClass(badgeTone)}`} title={badgeTitle ?? undefined}>{badge}</span>
                            )}
                          </>
                        )}
                      </a>
                    );
                  }

                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/courses'}
                      data-tour={dataTour}
                      className={({ isActive }) =>
                        `flex items-center rounded-xl text-gray-700 dark:text-foreground hover:bg-muted transition-colors py-2.5 text-sm leading-snug ${isActive ? 'nav-link-active' : ''} ${isCollapsed ? 'justify-center px-2' : 'px-4'}`
                      }
                    >
                      <Icon className={`w-5 h-5 shrink-0 opacity-70 ${isCollapsed ? '' : 'mr-3'}`} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 min-w-0 text-foreground text-sm">{label}</span>
                          {comingSoon && (
                            <span className="ml-2 shrink-0 rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-subtle-foreground">
                              {t('shell.nav.soon')}
                            </span>
                          )}
                          {badge > 0 && (
                            <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${badgeToneClass(badgeTone)}`} title={badgeTitle ?? undefined}>{badge}</span>
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
      
      <div className="mt-auto pt-4 border-t">
        <div className="relative" data-tour="profile-nav">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-lg hover:bg-muted transition-colors`}
          >
            <div className="flex items-center">
              {(() => {
                const avatar = (
                  <UserAvatar
                    userId={user?.id}
                    name={user?.name}
                    avatarUrl={user?.avatar_url}
                    mascot={user?.mascot}
                    isStudent={user?.role === 'student'}
                    size={40}
                  />
                );
                // Offsets clear the sidebar (w-64 / collapsed w-20) so the card never covers it.
                return variant === 'desktop'
                  ? <KasatikCoachmark sideOffset={isCollapsed ? 34 : 198}>{avatar}</KasatikCoachmark>
                  : avatar;
              })()}
              {!isCollapsed && (
                <div className="ml-3 text-left">
                  <div className="text-sm font-medium text-foreground line-clamp-1">{user?.name || t('shell.menu.userFallback')}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel(user?.role)}</div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          
          {isDropdownOpen && (
            <div className={`absolute bottom-full ${isCollapsed ? 'left-full ml-2 w-48' : 'left-0 right-0 w-full'} mb-2 bg-popover border border-border rounded-lg shadow-lg py-2 z-50`}>
              <NavLink
                to="/profile"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-foreground hover:bg-muted transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-3" />
                {t('shell.menu.profile')}
              </NavLink>
              <NavLink
                to="/settings"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4 mr-3" />
                {t('shell.menu.settings')}
              </NavLink>
              {replayKind && (
                <button
                  type="button"
                  data-guide-replay
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onClose?.();
                    requestTourReplay(navigate, pathname);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-foreground hover:bg-muted transition-colors"
                >
                  <Route className="w-4 h-4 mr-3" />
                  {t('guide.tour.replay')}
                </button>
              )}
              <div className="border-t my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                {t('shell.menu.logout')}
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
      <div className="absolute top-0 left-0 w-64 h-full bg-card border-r border-border p-0">
        <Sidebar variant="mobile" onClose={onClose} />
      </div>
    </div>
  );
}
