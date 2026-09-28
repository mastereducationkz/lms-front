import { UserRole } from '../types';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  disableBeacon?: boolean;
}

// Туры для студентов
const studentTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Your Learning Journey!',
    content: 'Let\'s take a quick tour to help you navigate the platform and make the most of your learning experience.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="courses-nav"]',
    title: 'Your Courses',
    content: 'Access all your enrolled courses here. Browse course materials, lessons, and track your progress.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dashboard-stats"]',
    title: 'Your Progress Dashboard',
    content: 'Track your learning statistics, including completed courses, current streak, and study time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="streak-display"]',
    title: 'Daily Streak',
    content: 'Keep your learning streak alive! Study every day to maintain and increase your streak count.',
    placement: 'left',
  },
  {
    target: '[data-tour="recent-courses"]',
    title: 'Continue Learning',
    content: 'Your recently accessed courses appear here. Click to continue where you left off.',
    placement: 'top',
  },
  {
    target: '[data-tour="calendar-nav"]',
    title: 'Schedule & Events',
    content: 'Check upcoming events, deadlines, and schedule your study sessions.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="messages-nav"]',
    title: 'Messages',
    content: 'Communicate with your teachers and classmates. Get help and collaborate on assignments.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="profile-nav"]',
    title: 'Your Profile',
    content: 'Update your personal information, change settings, and view your achievements.',
    placement: 'bottom',
  },
];

// Туры для учителей
const teacherTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome, Teacher!',
    content: 'Let\'s explore the teaching tools and features available to you.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="courses-nav"]',
    title: 'Course Management',
    content: 'Create, edit, and manage your courses. Add lessons, assignments, and track student progress.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dashboard-overview"]',
    title: 'Teaching Dashboard',
    content: 'Overview of your classes, student statistics, and recent activity.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="students-section"]',
    title: 'Student Management',
    content: 'View your students, check their progress, and provide feedback on assignments.',
    placement: 'top',
  },
  {
    target: '[data-tour="create-course"]',
    title: 'Create New Course',
    content: 'Start creating a new course with our intuitive course builder. Add modules, lessons, and materials.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-nav"]',
    title: 'Analytics',
    content: 'Access detailed analytics about student performance, engagement, and course effectiveness.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="calendar-nav"]',
    title: 'Schedule Events',
    content: 'Create events, set deadlines, and manage your teaching schedule.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="messages-nav"]',
    title: 'Student Communication',
    content: 'Message your students, answer questions, and provide guidance.',
    placement: 'bottom',
  },
];

// Туры для администраторов
const adminTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Admin Control Center!',
    content: 'Let\'s take a comprehensive tour of your administrative capabilities. You have full control over the learning management system.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard-overview"]',
    title: 'System Dashboard Overview',
    content: 'Monitor key metrics: total users, students, teachers, and courses. Track recent registrations and system activity at a glance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="users-management"]',
    title: 'User Management',
    content: 'Create and manage all user accounts. Add students, teachers, curators, and other admins. Assign roles, reset passwords, and control access.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="groups-section"]',
    title: 'Group Management',
    content: 'Organize students into groups, assign teachers and curators. Groups help structure your educational programs and track cohort progress.',
    placement: 'left',
  },
  {
    target: '[data-tour="courses-management"]',
    title: 'Course Administration',
    content: 'View and manage all courses in the system. Monitor course creation, content quality, and course assignments to groups.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-nav"]',
    title: 'Analytics & Reports',
    content: 'Access comprehensive analytics: student performance, engagement metrics, course completion rates, and platform usage statistics.',
    placement: 'bottom',
  },
];

// Туры для кураторов
const curatorTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome, Curator!',
    content: 'Let\'s explore the tools you\'ll use to support and guide your student groups.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard-overview"]',
    title: 'Group Overview',
    content: 'Monitor your assigned groups\' progress and activity.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="students-section"]',
    title: 'Your Students',
    content: 'View and manage students in your groups. Track their progress and engagement.',
    placement: 'top',
  },
  {
    target: '[data-tour="groups-section"]',
    title: 'Manage Groups',
    content: 'Organize your student groups, schedule meetings, and coordinate activities.',
    placement: 'top',
  },
  {
    target: '[data-tour="analytics-nav"]',
    title: 'Group Analytics',
    content: 'Access analytics for your groups to identify students who need additional support.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="calendar-nav"]',
    title: 'Schedule & Events',
    content: 'Organize group meetings, track important dates, and manage events.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="messages-nav"]',
    title: 'Communication',
    content: 'Stay in touch with your students and coordinate with teachers.',
    placement: 'bottom',
  },
];

export function getTourStepsForRole(role: UserRole): TourStep[] {
  switch (role) {
    case 'student':
      return studentTourSteps;
    case 'teacher':
      return teacherTourSteps;
    case 'admin':
      return adminTourSteps;
    case 'curator':
      return curatorTourSteps;
    default:
      return studentTourSteps;
  }
}

export { studentTourSteps, teacherTourSteps, adminTourSteps, curatorTourSteps };
