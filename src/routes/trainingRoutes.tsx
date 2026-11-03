import type { ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { lazyRoute } from '../lib/lazyRoute';
import ProtectedRoute from '../components/ProtectedRoute.tsx';
import AppLayout from '../layouts/AppLayout.tsx';
import type { UserRole } from '../types';

const TrainingHomePage = lazyRoute(() => import('../pages/staff-training/TrainingHomePage.tsx'));
const TrainingLibraryPage = lazyRoute(() => import('../pages/staff-training/TrainingLibraryPage.tsx'));
const ClipPage = lazyRoute(() => import('../pages/staff-training/ClipPage.tsx'));
const TaskPage = lazyRoute(() => import('../pages/staff-training/TaskPage.tsx'));
const ProgressPage = lazyRoute(() => import('../pages/staff-training/ProgressPage.tsx'));
const ProgressDetailPage = lazyRoute(() => import('../pages/staff-training/ProgressDetailPage.tsx'));

/**
 * Staff training («Обучение сотрудников», docs/training/CONTRACTS.md §8). Every staff role opens the track, the
 * library, clips and tasks, marketing included; the progress pages are for admins and the two heads (the server
 * narrows them to the roles each may see). Students and parents never get here.
 */
export function trainingRoutes() {
  const page = (path: string, roles: UserRole[], element: ReactElement) => (
    <Route key={path} path={path} element={
      <ProtectedRoute allowedRoles={roles}>
        <AppLayout>{element}</AppLayout>
      </ProtectedRoute>
    } />
  );
  const staff: UserRole[] = ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing'];
  const heads: UserRole[] = ['admin', 'head_curator', 'head_teacher'];
  return [
    page('/training', staff, <TrainingHomePage />),
    page('/training/library', staff, <TrainingLibraryPage />),
    page('/training/clips/:clipId', staff, <ClipPage />),
    page('/training/tasks/:taskId', staff, <TaskPage />),
    page('/training/progress', heads, <ProgressPage />),
    page('/training/progress/:userId', heads, <ProgressDetailPage />),
  ];
}
