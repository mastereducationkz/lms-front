import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import apiClient from "../services/api";
import Skeleton from '../components/Skeleton.tsx';
import type { DashboardStats, Course, User } from '../types';

// Each role dashboard is lazy so a user only downloads the chunk for their own
// role (TeacherDashboard/AdminDashboard/HeadCuratorDashboard pull in recharts —
// eagerly importing all five made every role pay for all of them on first load).
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const TeacherDashboard = lazy(() => import('./TeacherDashboard.tsx'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard.tsx'));
const HeadCuratorDashboard = lazy(() => import('./HeadCuratorDashboard.tsx'));
const HeadTeacherDashboardPage = lazy(() => import('./HeadTeacherDashboardPage.tsx'));

function DashboardChunkFallback() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-80 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-6">
            <Skeleton className="h-16 w-16 mb-4" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardData {
  user?: User;
  stats?: DashboardStats;
  recent_courses?: Course[];
  recent_activity?: any[];
}



export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isTeacher } = useAuth();
  const navigate = useNavigate();

  // Role-based dashboards - Return early BEFORE loading generic student stats
  if (user?.role === 'admin') {
    return (
      <Suspense fallback={<DashboardChunkFallback />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  if (user?.role === 'curator' || user?.role === 'head_curator') {
    return (
      <Suspense fallback={<DashboardChunkFallback />}>
        <HeadCuratorDashboard />
      </Suspense>
    );
  }

  if (user?.role === 'head_teacher') {
    return (
      <Suspense fallback={<DashboardChunkFallback />}>
        <HeadTeacherDashboardPage />
      </Suspense>
    );
  }

  if (isTeacher()) {
    return (
      <Suspense fallback={<DashboardChunkFallback />}>
        <TeacherDashboard />
      </Suspense>
    );
  }

  // Load data only for students or if valid role not caught above (fallback)
  useEffect(() => {
    // Only load student/generic dashboard data if we haven't returned a specialized dashboard above
    loadDashboardData();
  }, [user?.role]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Загружаем основные данные дашборда
      const data = await apiClient.getDashboardStats();
      setDashboardData(data as DashboardData);


    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(errorMessage);
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-80 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6">
              <Skeleton className="h-16 w-16 mb-4" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-6">
                <Skeleton className="h-40 mb-4" />
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <Skeleton className="h-3 w-full mb-4" />
                <Skeleton className="h-9 w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-300">Error loading dashboard</h3>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const firstName = dashboardData?.user?.name || user?.name?.split(' ')[0] || 'User';
  const stats = dashboardData?.stats || {} as DashboardStats;

  return (
    <Suspense fallback={<DashboardChunkFallback />}>
      <StudentDashboard
        firstName={firstName}
        stats={stats}
        onContinueCourse={(id: string) => navigate(`/course/${id}`)}
        onGoToAllCourses={() => navigate('/courses')}
      />
    </Suspense>
  );
}
