import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNextStep } from 'nextstepjs';
import { Button } from '../components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { storage } from '../utils/storage';

export default function SettingsPage() {
  const [notifications, setNotifications] = useState<boolean>(true);
  const [theme, setTheme] = useState<string>('light');
  const { user } = useAuth();
  const { startNextStep } = useNextStep();

  const handleRestartTour = () => {
    if (!user) return;
    
    // Запускаем тур заново с именем для текущей роли
    const tourName = `${user.role}-onboarding`;
    startNextStep(tourName);
  };

  const handleResetOnboarding = () => {
    if (!user) return;
    
    // Удаляем флаг завершения онбординга
    storage.removeItem(`onboarding_completed_${user.id}`);
    
    // Перезагружаем страницу, чтобы показать приветственные экраны
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold dark:text-white">Settings</h1>
      
      <div className="bg-white dark:bg-card rounded-2xl shadow-card p-6 max-w-xl space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Onboarding & Tour</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Restart the platform tour or reset the complete onboarding experience.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleRestartTour}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Restart Tour
          </Button>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          The tour will guide you through the main features of your {user?.role || 'user'} dashboard.
          {' '}Note: Settings are stored in {storage.getItem('__storage_test__') !== null ? 'browser storage' : 'session memory'}.
        </p>
      </div>
    </div>
  );
}

