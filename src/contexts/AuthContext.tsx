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

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      if (apiClient.isAuthenticated()) {
        // Get current user info
        const currentUser = await apiClient.getCurrentUser();
        setUser(currentUser);
        apiClient.setCurrentUser(currentUser);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // If getting current user fails, clear tokens
      await logout();
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
      await logout();
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
