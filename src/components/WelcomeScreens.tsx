import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/shell';

interface WelcomeScreensProps {
  userName: string;
  userRole: UserRole;
  onComplete: () => void;
}

export default function WelcomeScreens({ userName, userRole, onComplete }: WelcomeScreensProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const t = useT();

  useEffect(() => {
    if (currentScreen === 0) {
      // First screen: "Hello, {name}!" - показываем 2 секунды
      const timer = setTimeout(() => {
        setCurrentScreen(1);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (currentScreen === 1) {
      // Second screen: Role-specific welcome - показываем 2.5 секунды
      const timer = setTimeout(() => {
        onComplete();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, onComplete]);

  const firstName = userName?.split(' ')[0] || '';

  // Never a wall: a click, a key or the button skips straight to the tour.
  useEffect(() => {
    const skip = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onComplete();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [onComplete]);

  // Определяем текст второго экрана в зависимости от роли
  const getWelcomeMessage = () => {
    switch (userRole) {
      case 'student':
        return {
          main: t('shell.welcome.studentMain'),
          highlight: t('shell.welcome.studentHighlight')
        };
      case 'teacher':
        return {
          main: t('shell.welcome.teacherMain'),
          highlight: t('shell.welcome.teacherHighlight')
        };
      case 'curator':
        return {
          main: t('shell.welcome.curatorMain'),
          highlight: t('shell.welcome.curatorHighlight')
        };
      case 'admin':
        return {
          main: t('shell.welcome.adminMain'),
          highlight: t('shell.welcome.adminHighlight')
        };
      default:
        return {
          main: t('shell.welcome.defaultMain'),
          highlight: t('shell.welcome.defaultHighlight')
        };
    }
  };

  const welcomeMessage = getWelcomeMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-background" onClick={onComplete} data-guide="welcome">
      <button
        type="button"
        onClick={onComplete}
        className="absolute bottom-6 right-6 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('shell.welcome.skip')}
      </button>
      <div className="text-center px-4">
        <AnimatePresence mode="wait">
          {currentScreen === 0 && (
            <motion.h1
              key="hello"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="text-6xl md:text-8xl font-light text-gray-900 dark:text-foreground"
            >
              {t('shell.welcome.hello')}
              {firstName && (
                <>
                  ,{' '}
                  <span
                    className="italic font-serif bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {firstName}
                  </span>
                </>
              )}
              !
            </motion.h1>
          )}

          {currentScreen === 1 && (
            <motion.h1
              key="welcome"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-5xl md:text-7xl font-light text-gray-900 dark:text-foreground"
            >
              {welcomeMessage.main}{' '}
              <br />
              <span
                className="italic font-serif bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {welcomeMessage.highlight}
              </span>
            </motion.h1>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
