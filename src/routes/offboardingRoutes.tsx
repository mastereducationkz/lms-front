import type { ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { lazyRoute } from '../lib/lazyRoute';
import ProtectedRoute from '../components/ProtectedRoute.tsx';
import AppLayout from '../layouts/AppLayout.tsx';
import type { UserRole } from '../types';

const OffboardingPage = lazyRoute(() => import('../pages/admin/OffboardingPage.tsx'));
const OffboardingRecordPage = lazyRoute(() => import('../pages/admin/OffboardingRecordPage.tsx'));
const OffboardingSettingsPage = lazyRoute(() => import('../pages/admin/OffboardingSettingsPage.tsx'));
const AccessReviewPage = lazyRoute(() => import('../pages/admin/AccessReviewPage.tsx'));

/**
 * Staff offboarding (docs/offboarding/SPEC.md §9). The list and records also serve head curators
 * and head teachers — the server scopes them to the people they may offboard; settings and the
 * access review are admin-only. Every page shows nothing while the feature is switched off.
 */
export function offboardingRoutes() {
  const page = (path: string, roles: UserRole[], element: ReactElement) => (
    <Route key={path} path={path} element={
      <ProtectedRoute allowedRoles={roles}>
        <AppLayout>{element}</AppLayout>
      </ProtectedRoute>
    } />
  );
  const heads: UserRole[] = ['admin', 'head_curator', 'head_teacher'];
  return [
    page('/admin/offboarding', heads, <OffboardingPage />),
    page('/admin/offboarding/settings', ['admin'], <OffboardingSettingsPage />),
    page('/admin/offboarding/access-review', ['admin'], <AccessReviewPage />),
    page('/admin/offboarding/:id', heads, <OffboardingRecordPage />),
  ];
}
