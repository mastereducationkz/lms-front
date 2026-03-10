import { useState, useEffect } from 'react';
import { SidebarDesktop, SidebarMobile } from '../components/Sidebar.tsx';
import Topbar from '../components/Topbar.tsx';
import { Toaster } from '../components/Toast.tsx';
import PlatformUpdatesModal from '../components/PlatformUpdatesModal.tsx';
import DailyQuestionsPopup from '../components/DailyQuestionsPopup.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Link } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isReferralBannerHidden, setIsReferralBannerHidden] = useState(() => {
    return localStorage.getItem('studentReferralBannerHidden') === 'true';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('mainSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('mainSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleCloseReferralBanner = () => {
    setIsReferralBannerHidden(true);
    localStorage.setItem('studentReferralBannerHidden', 'true');
    setIsReferralModalOpen(false);
  };

  return (
    <div className="flex">
      <SidebarDesktop isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className={`flex-1 bg-gray-50 dark:bg-background h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* <MaintenanceBanner /> */}
        {user?.role === 'student' && !isReferralBannerHidden && (
          <section className="relative mx-4 mt-3 sm:mx-5 md:mx-6 rounded-lg border border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-100">
            <button
              onClick={handleCloseReferralBanner}
              className="absolute right-2 top-2 z-10 rounded-md p-1 text-emerald-700/80 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
              aria-label="Скрыть реферальный баннер"
            >
              ✕
            </button>
            <button
              onClick={() => setIsReferralModalOpen(true)}
              className="block w-full px-3 py-2.5 pr-10 text-left sm:px-4 sm:py-2.5"
              aria-label="Открыть подробную информацию о реферальной системе"
            >
              <p className="text-xs font-medium sm:text-sm">
                Узнай о нашей реферальной системе - приведи друга и получи 15 000 ₸
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-800/90 sm:text-xs dark:text-emerald-200/90">
                Нажми, чтобы посмотреть детали
              </p>
            </button>
          </section>
        )}
        {user?.role === 'student' && isReferralModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Информация о реферальной системе"
            onClick={() => setIsReferralModalOpen(false)}
          >
            <div
              className="relative w-full max-w-xl rounded-xl border border-emerald-200 bg-white p-4 text-emerald-950 shadow-xl dark:border-emerald-800 dark:bg-card dark:text-emerald-100 sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setIsReferralModalOpen(false)}
                className="absolute right-2 top-2 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                aria-label="Закрыть окно с подробной информацией"
              >
                ✕
              </button>
              <h2 className="pr-7 text-base font-semibold sm:text-lg">
                Узнай о нашей реферальной системе!
              </h2>
              <p className="mt-1 text-sm font-medium sm:text-base">
                Приведи друга - получи 15 000 ₸!
              </p>
              <p className="mt-2.5 text-sm sm:text-[15px]">
                Знаешь кого-то, кто готовится к SAT или IELTS? Порекомендуй нас - и получи 15 000 ₸ за каждого нового ученика, который начнёт заниматься.
              </p>
              <div className="mt-3 text-sm sm:text-[15px]">
                <p className="font-medium">Как это работает:</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>Отправь контакт друга своему куратору</li>
                  <li>Мы свяжемся с ним и всё расскажем</li>
                  <li>Как только он начнет обучение - ты получаешь 15 000 ₸</li>
                </ol>
              </div>
              <p className="mt-3 text-sm font-medium sm:text-[15px]">
                Без ограничений по количеству. Чем больше друзей, тем больше бонус.
              </p>
              <p className="mt-1 text-sm sm:text-[15px]">
                Твой друг тоже получает скидку 15 000 ₸ на старт обучения.
              </p>
            </div>
          </div>
        )}
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
