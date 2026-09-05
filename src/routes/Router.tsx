import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { applyPendingPwaUpdate } from '../services/pwa';
import { NextStepProvider } from 'nextstepjs';
import { AuthProvider } from '../contexts/AuthContext.tsx';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ThemeProvider } from '../components/ThemeProvider.tsx';
import { Toaster } from '../components/Toast';
import OnboardingManager from '../components/OnboardingManager.tsx';
import ProtectedRoute from '../components/ProtectedRoute.tsx';
import AppLayout from '../layouts/AppLayout.tsx';
import Loader from '../components/Loader';

// Pages are code-split with React.lazy so the initial download is a small app shell plus only
// the chunk for the current route. Previously all ~59 pages were eagerly imported into a single
// 3.4 MB bundle that every user downloaded on first load regardless of route. Structural pieces
// above (providers, AppLayout shell, ProtectedRoute) stay eager since they load on every route.
const LoginPage = lazy(() => import('../pages/LoginPage.tsx'));
const CheckpointsPage = lazy(() => import('../pages/CheckpointsPage.tsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx'));
const CoursesPage = lazy(() => import('../pages/CoursesPage.tsx'));
const CourseOverviewPage = lazy(() => import('../pages/CourseOverviewPage.tsx'));
const ModulePage = lazy(() => import('../pages/ModulePage.tsx'));
const LecturePage = lazy(() => import('../pages/LecturePage.tsx'));
const AssignmentsPage = lazy(() => import('../pages/assingments/AssignmentsPage.tsx'));
const AssignmentPage = lazy(() => import('../pages/assingments/AssignmentPage.tsx'));
const AssignmentRecordPage = lazy(() => import('../pages/assingments/AssignmentRecordPage.tsx'));
const AssignmentBuilderPage = lazy(() => import('../pages/assingments/AssignmentBuilderPage.tsx'));
const AssignmentGradingPage = lazy(() => import('../pages/assingments/AssignmentGradingPage.tsx'));
const AssignmentStudentProgressPage = lazy(() => import('../pages/assingments/AssignmentStudentProgressPage.tsx'));
const ChatPage = lazy(() => import('../pages/ChatPage.tsx'));
const TeacherDashboard = lazy(() => import('../pages/TeacherDashboard.tsx'));
const QuizzesPage = lazy(() => import('../pages/QuizzesPage.tsx'));
const QuizPage = lazy(() => import('../pages/QuizPage.tsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.tsx'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx'));
const TeacherCoursesPage = lazy(() => import('../pages/TeacherCoursesPage.tsx'));
const CourseBuilderPage = lazy(() => import('../pages/CourseBuilderPage.tsx'));
const CreateCourseWizard = lazy(() => import('../pages/CreateCourseWizard.tsx'));
const LessonEditPage = lazy(() => import('../pages/LessonEditPage.tsx'));
const TeacherClassPage = lazy(() => import('../pages/TeacherClassPage.tsx'));
const AttendancePage = lazy(() => import('../pages/AttendancePage.tsx'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard.tsx'));
const AssignmentZeroSubmissions = lazy(() => import('../pages/admin/AssignmentZeroSubmissions.tsx'));
const BluebookGroupGridPage = lazy(() => import('../pages/BluebookGroupGridPage.tsx'));
const ExamResultsWorkbenchPage = lazy(() => import('../pages/ExamResultsWorkbenchPage.tsx'));
const QuestionReportsPage = lazy(() => import('../pages/admin/QuestionReportsPage.tsx'));
const WeeklyTopStudentsPage = lazy(() => import('../pages/admin/WeeklyTopStudentsPage.tsx'));
const CheckpointsAdminPage = lazy(() => import('../pages/admin/CheckpointsAdminPage.tsx'));
const UserManagement = lazy(() => import('../pages/UserManagement.tsx'));
const ManualUnlocksPage = lazy(() => import('../pages/admin/ManualUnlocksPage.tsx'));
const TrialAccessPage = lazy(() => import('../pages/admin/TrialAccessPage.tsx'));
const LessonRequestManagement = lazy(() => import('../pages/admin/LessonRequestManagement.tsx'));
const LessonPage = lazy(() => import('../pages/LessonPage.tsx'));
const PracticePrintPage = lazy(() => import('../pages/PracticePrintPage.tsx'));
const CourseProgressPage = lazy(() => import('../pages/CourseProgressPage.tsx'));
const EventManagement = lazy(() => import('../pages/EventManagement.tsx'));
const CreateEvent = lazy(() => import('../pages/CreateEvent.tsx'));
const EditEvent = lazy(() => import('../pages/EditEvent.tsx'));
const Calendar = lazy(() => import('../pages/Calendar.tsx'));
const SubstitutionRequestPage = lazy(() => import('../pages/SubstitutionRequestPage.tsx'));
const MyLessonRequests = lazy(() => import('../pages/MyLessonRequests.tsx'));
const HeadTeacherLessonRequestsPage = lazy(() => import('../pages/HeadTeacherLessonRequestsPage.tsx'));
const LandingPage = lazy(() => import('../pages/LandingPage.tsx'));
const AnalyticsPage = lazy(() => import('../pages/analytics/AnalyticsPage.tsx'));
const FavoriteFlashcardsPage = lazy(() => import('../pages/FavoriteFlashcardsPage.tsx'));
const CuratorHomeworksPage = lazy(() => import('../pages/CuratorHomeworksPage.tsx'));
const CuratorLeaderboardPage = lazy(() => import('../pages/CuratorLeaderboardPage.tsx'));
const CuratorGroupsPage = lazy(() => import('../pages/CuratorGroupsPage.tsx'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage.tsx'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage.tsx'));
const OidcCallbackPage = lazy(() => import('../pages/auth/OidcCallbackPage.tsx'));
const AssignmentZeroPage = lazy(() => import('../pages/AssignmentZeroPage'));
const StudentAnalyticsPage = lazy(() =>
  import('../pages/analytics/StudentAnalyticsPage.tsx').then((m) => ({ default: m.StudentAnalyticsPage }))
);
const HeadTeacherTeacherDetailsPage = lazy(() => import('../pages/HeadTeacherTeacherDetailsPage.tsx'));
const HeadCuratorCuratorPage = lazy(() => import('../pages/HeadCuratorCuratorPage.tsx'));
const CuratorTasksPage = lazy(() => import('../pages/CuratorTasksPage.tsx'));
// Onboarding is now edited in the CRM; this path only redirects. The old page component is
// deliberately left in the tree, unrouted, so the migration can be reverted by pointing the
// route back at it if the CRM board has to be switched off.
const CuratorOnboardingRedirect = lazy(() => import('../pages/CuratorOnboardingRedirect.tsx'));
const StudentsJournalPage = lazy(() => import('../pages/StudentsJournalPage.tsx'));
const StudentProfilePage = lazy(() => import('../pages/StudentProfilePage.tsx'));
const StudentReportPage = lazy(() => import('../pages/StudentReportPage.tsx'));

// Fallback shown while a route chunk is fetched.
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <Loader size="xl" animation="spin" color="#2563eb" />
  </div>
);

// Applies a waiting PWA update on route change — a safe moment to swap the
// bundle since the current page is unmounting anyway. No-op unless an update is
// pending. Must live inside <BrowserRouter> to use useLocation().
function PwaUpdateOnNavigate() {
  const location = useLocation();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    applyPendingPwaUpdate();
  }, [location.pathname]);
  return null;
}

export default function Router() {

  return (
    <BrowserRouter>
      <PwaUpdateOnNavigate />
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Toaster />
        <AuthProvider>
          <SettingsProvider>
            <NextStepProvider>
              <OnboardingManager>
                <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={
                    <ProtectedRoute requireAuth={false}>
                      <LandingPage />
                  </ProtectedRoute>
                } />
                {/* Auth Routes */}
                <Route path="/login" element={
                  <ProtectedRoute requireAuth={false}>
                      <LoginPage />
                  </ProtectedRoute>
                } />
                <Route path="/forgot-password" element={
                  <ProtectedRoute requireAuth={false}>
                      <ForgotPasswordPage />
                  </ProtectedRoute>
                } />
                <Route path="/reset-password" element={
                  <ProtectedRoute requireAuth={false}>
                      <ResetPasswordPage />
                  </ProtectedRoute>
                } />
                {/* SSO Phase 2 — OIDC (Zitadel) PKCE callback */}
                <Route path="/auth/callback" element={<OidcCallbackPage />} />

          {/* Assignment Zero - Self-Assessment for new students */}
          <Route path="/assignment-zero" element={
            <ProtectedRoute allowedRoles={['student']} skipAssignmentZeroCheck={true}>
              <AssignmentZeroPage />
            </ProtectedRoute>
          } />

          {/* Protected App Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout>
                <Navigate to="/dashboard" replace />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/courses" element={
            <ProtectedRoute>
              <AppLayout>
                <CoursesPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/course/:courseId" element={
            <ProtectedRoute>
              <AppLayout>
                <CourseOverviewPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Updated module route with course context */}
          <Route path="/course/:courseId/module/:moduleId" element={
            <ProtectedRoute>
              <AppLayout>
                <ModulePage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Legacy module route - redirect to courses page */}
          <Route path="/module/:moduleId" element={
            <Navigate to="/courses" replace />
          } />

          <Route path="/lecture/:lectureId" element={
            <ProtectedRoute>
              <AppLayout>
                <LecturePage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework" element={
            <ProtectedRoute>
              <AppLayout>
                <AssignmentsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/checkpoints" element={
            <ProtectedRoute allowedRoles={['student']}>
              <AppLayout>
                <CheckpointsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/favorites" element={
            <ProtectedRoute allowedRoles={['student']}>
              <AppLayout>
                <FavoriteFlashcardsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:id" element={
            <ProtectedRoute>
              <AppLayout>
                <AssignmentPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:id/record" element={
            <ProtectedRoute allowedRoles={['student']}>
              <AppLayout>
                <AssignmentRecordPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:id/grade" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentGradingPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:id/progress" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'head_curator']}>
              <AppLayout>
                <AssignmentStudentProgressPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/new" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentBuilderPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/new/lesson/:lessonId" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentBuilderPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/new/group/:groupId" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentBuilderPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:assignmentId/edit" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentBuilderPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/chat" element={
            <ProtectedRoute>
              <AppLayout>
                <ChatPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/quizzes" element={
            <ProtectedRoute>
              <AppLayout>
                <QuizzesPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/quiz/:id" element={
            <ProtectedRoute>
              <AppLayout>
                <QuizPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <AppLayout>
                <ProfilePage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Teacher Routes */}
          <Route path="/teacher" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <TeacherDashboard />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/teacher/courses" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <TeacherCoursesPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/teacher/course/new" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <CreateCourseWizard />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/teacher/course/:courseId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <CourseBuilderPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/teacher/course/:courseId/progress" element={
            <ProtectedRoute>
              <AppLayout>
                <CourseProgressPage />
              </AppLayout>
            </ProtectedRoute>
          } />


          <Route path="/teacher/class" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <TeacherClassPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/course/:courseId/lesson/:lessonId/edit" element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'curator']}>
              <LessonEditPage />
            </ProtectedRoute>
          } />

          <Route path="/course/:courseId/lesson/:lessonId/practice-print" element={
            <ProtectedRoute>
              <PracticePrintPage />
            </ProtectedRoute>
          } />

          <Route path="/course/:courseId/lesson/:lessonId" element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          } />

          <Route path="/teacher/class/:classId" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <TeacherClassPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/attendance" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin', 'head_teacher', 'head_curator']}>
              <AppLayout>
                <AttendancePage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
              <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin', 'head_curator']}>
              <AppLayout>
                <UserManagement />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/weekly-top-students" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <WeeklyTopStudentsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/checkpoints" element={
            <ProtectedRoute allowedRoles={['admin', 'head_curator', 'head_teacher', 'teacher']}>
              <AppLayout>
                <CheckpointsAdminPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/courses" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <TeacherCoursesPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/events" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <EventManagement />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/assignment-zero" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <AssignmentZeroSubmissions />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* The one exam-results screen. Row scope is enforced server-side, so these
              roles are the outer gate only: a teacher sees their groups, an admin sees
              everything, from the same component. */}
          <Route path="/exam-results" element={
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'head_curator', 'head_teacher', 'admin']}>
              <AppLayout>
                <ExamResultsWorkbenchPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/exam-results-tracking" element={<Navigate to="/exam-results" replace />} />

          <Route path="/exam-results-workbench" element={<Navigate to="/exam-results" replace />} />

          <Route path="/bluebook-results" element={
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'head_curator', 'head_teacher', 'admin']}>
              <AppLayout>
                <BluebookGroupGridPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/question-reports" element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <AppLayout>
                <QuestionReportsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/lesson-requests" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <LessonRequestManagement />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/manual-unlocks" element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'head_teacher']}>
              <AppLayout>
                <ManualUnlocksPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/trial-access" element={
            <ProtectedRoute allowedRoles={['admin', 'head_curator']}>
              <AppLayout>
                <TrialAccessPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/events/create" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CreateEvent />
            </ProtectedRoute>
          } />

          <Route path="/admin/events/:eventId/edit" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EditEvent />
            </ProtectedRoute>
          } />

          <Route path="/calendar" element={
            <ProtectedRoute>
              <AppLayout>
                <Calendar />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/my-requests" element={
            <ProtectedRoute>
              <AppLayout>
                <MyLessonRequests />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/lesson-requests/new" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <SubstitutionRequestPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <AnalyticsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/student/:studentId" element={
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <StudentAnalyticsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/homeworks" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <CuratorHomeworksPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/leaderboard" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <CuratorLeaderboardPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/groups" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorGroupsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Head Teacher Routes */}
          {/* Dashboard is handled by /dashboard route and DashboardPage dispatcher */}

          <Route path="/head-teacher/course/:courseId/teacher/:teacherId" element={
            <ProtectedRoute allowedRoles={['head_teacher', 'admin']}>
              <AppLayout>
                <HeadTeacherTeacherDetailsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/head-teacher/lesson-requests" element={
            <ProtectedRoute allowedRoles={['head_teacher', 'head_curator']}>
              <AppLayout>
                <HeadTeacherLessonRequestsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Head Curator Routes */}
          <Route path="/head-curator/curator/:curatorId" element={
            <ProtectedRoute allowedRoles={['head_curator', 'admin']}>
              <AppLayout>
                <HeadCuratorCuratorPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/tasks" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorTasksPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/onboarding" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorOnboardingRedirect />
              </AppLayout>
            </ProtectedRoute>
          } />
          {/* Consolidated into /exam-results, which now carries the triage list, the
              record/reschedule actions and the filters+export the old pages lacked. */}
          <Route path="/curator/exam-results" element={<Navigate to="/exam-results" replace />} />

          <Route path="/curator/students" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <StudentsJournalPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/students/:studentId" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <StudentProfilePage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/students/:studentId/report" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <StudentReportPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/events/create" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CreateEvent />
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
                </Suspense>
            </OnboardingManager>
          </NextStepProvider>
        </SettingsProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
} 