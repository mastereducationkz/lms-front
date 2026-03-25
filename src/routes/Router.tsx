import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NextStepProvider } from 'nextstepjs';
import { AuthProvider } from '../contexts/AuthContext.tsx';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ThemeProvider } from '../components/ThemeProvider.tsx';
import { Toaster } from '../components/Toast';
import OnboardingManager from '../components/OnboardingManager.tsx';
import ProtectedRoute from '../components/ProtectedRoute.tsx';
import AppLayout from '../layouts/AppLayout.tsx';
import LoginPage from '../pages/LoginPage.tsx';
import DashboardPage from '../pages/DashboardPage.tsx';
import CoursesPage from '../pages/CoursesPage.tsx';
import CourseOverviewPage from '../pages/CourseOverviewPage.tsx';
import ModulePage from '../pages/ModulePage.tsx';
import LecturePage from '../pages/LecturePage.tsx';
import AssignmentsPage from '../pages/assingments/AssignmentsPage.tsx';
import AssignmentPage from '../pages/assingments/AssignmentPage.tsx';
import AssignmentBuilderPage from '../pages/assingments/AssignmentBuilderPage.tsx';
import AssignmentGradingPage from '../pages/assingments/AssignmentGradingPage.tsx';
import AssignmentStudentProgressPage from '../pages/assingments/AssignmentStudentProgressPage.tsx';
import ChatPage from '../pages/ChatPage.tsx';
import TeacherDashboard from '../pages/TeacherDashboard.tsx';

import QuizzesPage from '../pages/QuizzesPage.tsx';
import QuizPage from '../pages/QuizPage.tsx';
import ProfilePage from '../pages/ProfilePage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import TeacherCoursesPage from '../pages/TeacherCoursesPage.tsx';
import CourseBuilderPage from '../pages/CourseBuilderPage.tsx';
import CreateCourseWizard from '../pages/CreateCourseWizard.tsx';
// TeacherCoursePage functionality moved to CourseBuilderPage
import LessonEditPage from '../pages/LessonEditPage.tsx';
import TeacherClassPage from '../pages/TeacherClassPage.tsx';
import TeacherAttendancePage from '../pages/TeacherAttendancePage.tsx';
import AdminDashboard from '../pages/admin/AdminDashboard.tsx';
import AssignmentZeroSubmissions from '../pages/admin/AssignmentZeroSubmissions.tsx';
import ExamResultsTrackingPage from '../pages/admin/ExamResultsTrackingPage.tsx';
import QuestionReportsPage from '../pages/admin/QuestionReportsPage.tsx';
import UserManagement from '../pages/UserManagement.tsx';
import ManualUnlocksPage from '../pages/admin/ManualUnlocksPage.tsx';
import LessonRequestManagement from '../pages/admin/LessonRequestManagement.tsx';
import LessonPage from '../pages/LessonPage.tsx';
import CourseProgressPage from '../pages/CourseProgressPage.tsx';
import EventManagement from '../pages/EventManagement.tsx';
import CreateEvent from '../pages/CreateEvent.tsx';
import EditEvent from '../pages/EditEvent.tsx';
import Calendar from '../pages/Calendar.tsx';
import SubstitutionRequestPage from '../pages/SubstitutionRequestPage.tsx';
import MyLessonRequests from '../pages/MyLessonRequests.tsx';
import LandingPage from '../pages/LandingPage.tsx';
import AnalyticsPage from '../pages/analytics/AnalyticsPage.tsx';
import FavoriteFlashcardsPage from '../pages/FavoriteFlashcardsPage.tsx';
import CuratorHomeworksPage from '../pages/CuratorHomeworksPage.tsx';
import CuratorLeaderboardPage from '../pages/CuratorLeaderboardPage.tsx';
import AssignmentZeroPage from '../pages/AssignmentZeroPage';
import { StudentAnalyticsPage } from '../pages/analytics/StudentAnalyticsPage.tsx';
import HeadTeacherTeacherDetailsPage from '../pages/HeadTeacherTeacherDetailsPage.tsx';
import HeadCuratorCuratorPage from '../pages/HeadCuratorCuratorPage.tsx';
import CuratorTasksPage from '../pages/CuratorTasksPage.tsx';
import StudentsJournalPage from '../pages/StudentsJournalPage.tsx';
import StudentProfilePage from '../pages/StudentProfilePage.tsx';

export default function Router() {
  
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Toaster />
        <AuthProvider>
          <SettingsProvider>
            <NextStepProvider>
              <OnboardingManager>
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

          <Route path="/homework/:id/grade" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <AssignmentGradingPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/homework/:id/progress" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
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

          <Route path="/teacher/course/:courseId/lesson/:lessonId/edit" element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'curator']}>
              <LessonEditPage />
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
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <AppLayout>
                <TeacherAttendancePage />
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
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <UserManagement />
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

          <Route path="/exam-results" element={
            <ProtectedRoute allowedRoles={['admin', 'head_curator', 'head_teacher']}>
              <AppLayout>
                <ExamResultsTrackingPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/exam-results-tracking" element={<Navigate to="/exam-results" replace />} />

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
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <AppLayout>
                <ManualUnlocksPage />
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
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'admin', 'head_curator']}>
              <AppLayout>
                <AnalyticsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/student/:studentId" element={
            <ProtectedRoute allowedRoles={['teacher', 'curator', 'admin', 'head_curator']}>
              <AppLayout>
                <StudentAnalyticsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/homeworks" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorHomeworksPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/leaderboard" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorLeaderboardPage />
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

          <Route path="/curator/students" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <StudentsJournalPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/curator/students/:studentId" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <StudentProfilePage />
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
            </OnboardingManager>
          </NextStepProvider>
        </SettingsProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
} 