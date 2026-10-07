import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SidebarDesktop, SidebarMobile } from '../components/Sidebar.tsx';
import Topbar from '../components/Topbar.tsx';
import PlatformUpdatesModal from '../components/PlatformUpdatesModal.tsx';
import DailyQuestionsPopup from '../components/DailyQuestionsPopup.tsx';
import UnlockCelebration from '../components/achievements/UnlockCelebration';
import { useAuth } from '../contexts/AuthContext.tsx';
import apiClient from '../services/api';
import { hideReferral, readReferralHidden, useAttention } from '../lib/attention';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/shell';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const queue = useAttention(user);
  const [referralHiddenNow, setReferralHiddenNow] = useState(false);
  const localStore = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  // Per student (the old key was shared by everyone on the browser), and only on a quiet visit:
  // never the first-login visit, never one that already had a popup — once up, it stays up.
  const isReferralBannerHidden = referralHiddenNow
    || !user
    || readReferralHidden(localStore, user.id)
    || !queue.nudgeAllowed('referral');
  const [isSpecialGroupStudent, setIsSpecialGroupStudent] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('mainSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('mainSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const loadSpecialGroupsState = async () => {
      if (user?.role !== 'student') {
        setIsSpecialGroupStudent(false);
        return;
      }

      try {
        const myGroups = await apiClient.getMyGroups();
        const hasOnlySpecialGroups = myGroups.length > 0 && myGroups.every(group => group.is_special);
        setIsSpecialGroupStudent(hasOnlySpecialGroups);
      } catch (error) {
        console.error('Failed to load group flags:', error);
        setIsSpecialGroupStudent(false);
      }
    };

    loadSpecialGroupsState();
  }, [user?.id, user?.role]);

  const handleCloseReferralBanner = () => {
    setReferralHiddenNow(true);
    if (user) hideReferral(localStore, user.id);
    setIsReferralModalOpen(false);
  };

  const referralVisible = user?.role === 'student' && !isSpecialGroupStudent && !isReferralBannerHidden;
  useEffect(() => {
    if (referralVisible) queue.noteNudgeShown('referral');
  }, [referralVisible, queue]);

  return (
    <div className="flex">
      <SidebarDesktop isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className={`flex-1 bg-gray-50 dark:bg-background h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* <MaintenanceBanner /> */}
        {referralVisible && (
          <section className="relative mx-4 mt-3 sm:mx-5 md:mx-6 rounded-lg border border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-100">
            <button
              onClick={handleCloseReferralBanner}
              className="absolute right-2 top-2 z-10 rounded-md p-1 text-emerald-700/80 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
              aria-label={t('shell.referral.hideBanner')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setIsReferralModalOpen(true)}
              className="block w-full px-3 py-2.5 pr-10 text-left sm:px-4 sm:py-2.5"
              aria-label={t('shell.referral.openDetails')}
            >
              <p className="text-xs font-medium sm:text-sm">
                {t('shell.referral.bannerTitle')}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-800/90 sm:text-xs dark:text-emerald-200/90">
                {t('shell.referral.bannerHint')}
              </p>
            </button>
          </section>
        )}
        {user?.role === 'student' && !isSpecialGroupStudent && isReferralModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t('shell.referral.dialogLabel')}
            onClick={() => setIsReferralModalOpen(false)}
          >
            <div
              className="relative w-full max-w-xl rounded-xl border border-emerald-200 bg-card p-4 text-emerald-950 shadow-xl dark:border-emerald-800 dark:text-emerald-100 sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setIsReferralModalOpen(false)}
                className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-gray-800 dark:hover:text-foreground"
                aria-label={t('shell.referral.closeDialog')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <h2 className="pr-7 text-base font-semibold sm:text-lg">
                {t('shell.referral.dialogTitle')}
              </h2>
              <p className="mt-1 text-sm font-medium sm:text-base">
                {t('shell.referral.dialogLead')}
              </p>
              <p className="mt-2.5 text-sm sm:text-[15px]">
                {t('shell.referral.dialogBody')}
              </p>
              <div className="mt-3 text-sm sm:text-[15px]">
                <p className="font-medium">{t('shell.referral.howItWorks')}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>{t('shell.referral.step1')}</li>
                  <li>{t('shell.referral.step2')}</li>
                  <li>{t('shell.referral.step3')}</li>
                </ol>
              </div>
              <p className="mt-3 text-sm font-medium sm:text-[15px]">
                {t('shell.referral.noLimit')}
              </p>
            </div>
          </div>
        )}
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />
        {/* A size container: pages lay out by the width they get (@md:, @3xl: ...), not by the
            viewport - at 1100px the sidebar leaves ~780px, which lg: grids mistake for desktop. */}
        <div className="@container p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
      <SidebarMobile open={mobileOpen} onClose={() => setMobileOpen(false)} />
      
      {/* Platform Updates Modal - shows automatically to teachers/admins */}
      <PlatformUpdatesModal userRole={user?.role} />
      
      {/* Daily Questions Popup - shows automatically to students */}
      {user?.role === 'student' && <DailyQuestionsPopup />}

      {/* Kasatik Achievements: one celebration for every new unlock */}
      {user?.role === 'student' && <UnlockCelebration />}
    </div>
  );
}
