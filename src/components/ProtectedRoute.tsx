import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';
import Loader from './Loader';
import TrialExpiredPanel from './trial/TrialExpiredPanel';
import TrialBanner from './trial/TrialBanner';
import { parseAsUTC } from '../lib/datetime';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: UserRole[] | null;
  fallback?: React.ReactNode | null;
  skipAssignmentZeroCheck?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true, 
  allowedRoles = null,
  fallback = null,
  skipAssignmentZeroCheck = false
}) => {
  const { loading, isAuthenticated, hasAnyRole, user } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication, but only for protected routes
  if (loading && requireAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader size="xl" animation="spin" color="#2563eb" />
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated but trying to access auth pages (login)
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Special-group-only students must not use Assignment Zero (redirect if they open the URL)
  if (
    requireAuth &&
    isAuthenticated &&
    user?.role === 'student' &&
    user?.special_group_only_student &&
    location.pathname === '/assignment-zero'
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // If specific roles are required
  if (requireAuth && allowedRoles && !hasAnyRole(allowedRoles)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check Assignment Zero completion for students (except on the assignment-zero page itself)
  if (
    requireAuth && 
    isAuthenticated && 
    user?.role === 'student' && 
    !skipAssignmentZeroCheck &&
    user?.assignment_zero_completed === false &&
    !user?.special_group_only_student &&
    location.pathname !== '/assignment-zero'
  ) {
    return <Navigate to="/assignment-zero" replace />;
  }

  // Trial prospects: once no active grant remains, lock the app behind the upsell panel.
  // Scoped to role === 'student' && is_trial so it never affects non-trial users.
  // trial_expires_at is a naive-UTC string from the backend — parseAsUTC, not new Date(),
  // or the gate fires hours early/late depending on the browser's UTC offset.
  if (
    requireAuth &&
    isAuthenticated &&
    user?.role === 'student' &&
    user?.is_trial &&
    (!user?.trial_expires_at || parseAsUTC(user.trial_expires_at).getTime() <= Date.now())
  ) {
    return <TrialExpiredPanel />;
  }

  // Authenticated success path: mount the trial countdown banner here (not in AppLayout)
  // so it shows on EVERY protected route, including the few that render without AppLayout
  // (e.g. /course/:courseId/lesson/:lessonId). TrialBanner null-guards itself, so it
  // renders nothing (and sets no timers) for non-trial users.
  if (requireAuth && isAuthenticated) {
    return (
      <>
        <TrialBanner />
        {children}
      </>
    );
  }

  return children;
};

export default ProtectedRoute;
