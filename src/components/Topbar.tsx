import { useAuth } from '../contexts/AuthContext.tsx';
import { useEffect, useRef, useState } from 'react';
import { connectSocket } from '../services/socket';
import { Badge } from './ui/badge';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import ThemeMenu from './ThemeMenu';
import StreakIcon from './StreakIcon';
import { WhatsNewButton } from './PlatformUpdatesModal';
import PointsDisplay from './gamification/PointsDisplay';
import NotificationsBell from './NotificationsBell';
import { useT } from '../lib/i18n/react';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export default function Topbar({ onOpenSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const t = useT();
  const [unreadCount, setUnreadCount] = useState(0);
  // Sticky page headers (the lesson page's) sit just below this bar: publish its height.
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = bar.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const publish = () => document.documentElement.style.setProperty('--topbar-h', `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--topbar-h'); };
  }, []);
  
  const firstName = user?.name?.split(' ')[0] || 'User';
  
  useEffect(() => {
    if (!user) return;

    // Connect to socket and load unread count
    const socket = connectSocket();
    
    const loadUnreadCount = () => {
      if (socket.connected) {
        socket.emit('unread:count', (response: { unread_count: number }) => {
          setUnreadCount(response.unread_count || 0);
        });
      }
    };

    // Load initial count
    loadUnreadCount();

    // Listen for unread count updates
    const handleUnreadUpdate = () => {
      loadUnreadCount();
    };

    socket.on('unread:update', handleUnreadUpdate);
    
    return () => {
      socket.off('unread:update', handleUnreadUpdate);
    };
  }, [user]);
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div ref={bar} className="sticky top-0 z-10 bg-gray-50/80 dark:bg-card/80 backdrop-blur border-b border-border px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm sm:text-[14px] text-muted-foreground">{t('shell.topbar.welcomeBack')}</div>
        <div className="truncate text-[16px] sm:text-xl font-semibold text-foreground">{user?.name}!</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* <WhatsNewButton userRole={user?.role} /> */}
        {user?.role === 'student' && <PointsDisplay />}

        {user?.role !== 'parent' && <NotificationsBell />}
        <StreakIcon />
        <ThemeMenu />
        <button className="lg:hidden w-10 h-10 rounded-lg bg-card border flex items-center justify-center text-gray-700 dark:text-foreground" onClick={onOpenSidebar} aria-label={t('shell.topbar.openMenu')} data-tour="mobile-menu"><Menu className="w-5 h-5" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

