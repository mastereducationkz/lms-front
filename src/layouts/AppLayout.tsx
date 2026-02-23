import { useState, useEffect } from 'react';
import { SidebarDesktop, SidebarMobile } from '../components/Sidebar.tsx';
import Topbar from '../components/Topbar.tsx';
import { Toaster } from '../components/Toast.tsx';
import PlatformUpdatesModal from '../components/PlatformUpdatesModal.tsx';
import MaintenanceBanner from '../components/MaintenanceBanner.tsx';
import DailyQuestionsPopup from '../components/DailyQuestionsPopup.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('mainSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('mainSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  return (
    <div className="flex">
      <SidebarDesktop isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className={`flex-1 bg-gray-50 dark:bg-background h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* <MaintenanceBanner /> */}
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
        <Toaster />
      </main>
      <SidebarMobile open={mobileOpen} onClose={() => setMobileOpen(false)} />
      
      {/* Platform Updates Modal - shows automatically to teachers/admins */}
      <PlatformUpdatesModal userRole={user?.role} />
      
      {/* Daily Questions Popup - shows automatically to students */}
      {user?.role === 'student' && <DailyQuestionsPopup />}
    </div>
  );
}
