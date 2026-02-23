import { useAuth } from '../contexts/AuthContext.tsx';
import { useEffect, useState } from 'react';
import { connectSocket } from '../services/socket';
import { Badge } from './ui/badge';
import { Link } from 'react-router-dom';
import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import StreakIcon from './StreakIcon';
import { WhatsNewButton } from './PlatformUpdatesModal';
import PointsDisplay from './gamification/PointsDisplay';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export default function Topbar({ onOpenSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  
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
    <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-card/80 backdrop-blur border-b border-border px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 flex items-center justify-between">
      <div>
        <div className="text-sm sm:text-[14px] text-gray-500 dark:text-gray-400">{['curator', 'head_curator'].includes(user?.role || '') ? 'С возвращением' : 'Welcome back'}</div>
        <div className="text-[16px] sm:text-xl font-semibold text-gray-900 dark:text-white">{user?.name}!</div>
      </div>
      <div className="flex items-center gap-3">
        <WhatsNewButton userRole={user?.role} />
        {user?.role === 'student' && <PointsDisplay />}

        <StreakIcon />
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-9 h-9 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="lg:hidden w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 text-lg" onClick={onOpenSidebar} aria-label="Open menu">☰</button>
      </div>
    </div>
  );
}

