import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from "../services/api";
import type { User, UserRole } from '../types';
import { clearOidcSession, isOidcSession } from '../services/oidc';

interface AuthContextType {
  // State
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | undefined>;
  updateUser: (user: User) => void;

  // Role checks
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isStudent: () => boolean;
  isTeacher: () => boolean;
  isCurator: () => boolean;
  isAdmin: () => boolean;
  isTeacherOrAdmin: () => boolean;
  isCuratorOrAdmin: () => boolean;

  // Clear error
  clearError: () => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  // A failed /auth/me should only end the session when the credentials are genuinely
  // rejected (401/403). Network errors, timeouts and 5xx/429 are transient — the backend
  // may just be slow or restarting (rapid reloads make this more likely) — and must NOT
  // wipe the user's cookies, or a brief hiccup logs everyone out.
  const isGenuineAuthRejection = (err: unknown): boolean => {
    const status = (err as { status?: number } | null)?.status;
    return status === 401 || status === 403;
  };

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!apiClient.isAuthenticated()) {
        return;
      }

      // Retry transient failures with backoff so a short backend blip (or a reload storm)
      // doesn't drop a valid session. Give up only on a genuine auth rejection.
      const backoffMs = [0, 1000, 2000, 4000];
      let lastError: unknown;
      for (let attempt = 0; attempt < backoffMs.length; attempt++) {
        if (backoffMs[attempt] > 0) {
          await new Promise((r) => setTimeout(r, backoffMs[attempt]));
        }
        try {
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
          apiClient.setCurrentUser(currentUser);
          return;
        } catch (err) {
          lastError = err;
          if (isGenuineAuthRejection(err)) {
            // Credentials are invalid/revoked — the request interceptor has already
            // cleared tokens and redirected; clear local user state to match.
            await logout();
            return;
          }
          // Transient — fall through to the next retry.
        }
      }

      // All retries exhausted on a transient error: keep the session (tokens intact) and
      // surface a soft error instead of logging out. A later reload or action can recover.
      console.error('Auth initialization failed after retries (session preserved):', lastError);
      setError('Could not reach the server. Please check your connection and reload.');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiClient.login(email, password);
      
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    const wasOidc = isOidcSession();
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Stop IdP silent-renew so it can't re-inject a token after logout.
      if (wasOidc) {
        try { await clearOidcSession(); } catch { /* best-effort */ }
      }
      setUser(null);
      setError(null);
    }
  };

  const refreshUser = async (): Promise<User | undefined> => {
    try {
      if (apiClient.isAuthenticated()) {
        const currentUser = await apiClient.getCurrentUser();
        setUser(currentUser);
        apiClient.setCurrentUser(currentUser);
        return currentUser;
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // Only end the session on a genuine auth rejection; keep it on transient errors.
      if (isGenuineAuthRejection(error)) {
        await logout();
      }
    }
  };

  const updateUser = (updatedUser: User): void => {
    console.log('[AuthContext] updateUser called with:', {
      id: updatedUser.id,
      email: updatedUser.email,
      onboarding_completed: updatedUser.onboarding_completed,
      onboarding_completed_at: updatedUser.onboarding_completed_at
    });
    setUser(updatedUser);
    apiClient.setCurrentUser(updatedUser);
    console.log('[AuthContext] User state updated');
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user?.role ? roles.includes(user.role) : false;
  };

  const isStudent = (): boolean => hasRole('student');
  const isTeacher = (): boolean => hasRole('teacher');
  const isCurator = (): boolean => hasRole('curator');
  const isAdmin = (): boolean => hasRole('admin');
  const isTeacherOrAdmin = (): boolean => hasAnyRole(['teacher', 'admin']);
  const isCuratorOrAdmin = (): boolean => hasAnyRole(['curator', 'admin']);

  const value = {
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,

    // Actions
    login,
    logout,
    refreshUser,
    updateUser,

    // Role checks
    hasRole,
    hasAnyRole,
    isStudent,
    isTeacher,
    isCurator,
    isAdmin,
    isTeacherOrAdmin,
    isCuratorOrAdmin,

    // Clear error
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
