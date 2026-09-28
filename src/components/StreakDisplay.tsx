import React from 'react';
import { DailyStreakInfo } from '../types';
import { Flame, HeartCrack, Lightbulb, Target, TriangleAlert, Zap, type LucideIcon } from 'lucide-react';

interface StreakDisplayProps {
  streakInfo: DailyStreakInfo;
  className?: string;
}

const StreakDisplay: React.FC<StreakDisplayProps> = ({ streakInfo, className = '' }) => {
  const getStreakColor = () => {
    switch (streakInfo.streak_status) {
      case 'active':
        return 'text-orange-600 dark:text-orange-400';
      case 'at_risk':
        return 'text-amber-600 dark:text-amber-400';
      case 'broken':
        return 'text-gray-500 dark:text-gray-400';
      case 'not_started':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStreakIcon = (): LucideIcon => {
    switch (streakInfo.streak_status) {
      case 'active':
        return Flame;
      case 'at_risk':
        return TriangleAlert;
      case 'broken':
        return HeartCrack;
      default:
        return Target;
    }
  };
  const StatusIcon = getStreakIcon();

  const getStreakMessage = () => {
    switch (streakInfo.streak_status) {
      case 'active':
        return streakInfo.is_active_today ? 'Отличная работа!' : 'Продолжайте в том же духе!';
      case 'at_risk':
        return 'Не упустите свою серию!';
      case 'broken':
        return 'Начните новую серию!';
      case 'not_started':
        return 'Начните свою первую серию!';
      default:
        return 'Отслеживание активности';
    }
  };

  const formatLastActivity = () => {
    if (!streakInfo.last_activity_date) return 'Нет активности';
    
    const activityDate = new Date(streakInfo.last_activity_date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (activityDate.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (activityDate.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return activityDate.toLocaleDateString('ru-RU');
    }
  };

  return (
    <div className={`bg-white dark:bg-card rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground">Серия обучения</h3>
        <StatusIcon className={`h-6 w-6 ${getStreakColor()}`} aria-hidden="true" />
      </div>
      
      <div className="flex items-center mb-3">
        <span className={`text-3xl font-bold ${getStreakColor()}`}>
          {streakInfo.daily_streak}
        </span>
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          {streakInfo.daily_streak === 1 ? 'день' : 
           streakInfo.daily_streak < 5 ? 'дня' : 'дней'}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {getStreakMessage()}
      </p>
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <p>Последняя активность: {formatLastActivity()}</p>
        <p>Общее время изучения: {Math.round(streakInfo.total_study_time_minutes / 60)} ч</p>
      </div>
      
      {streakInfo.streak_status === 'at_risk' && (
        <div className="mt-3 flex items-start gap-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-300 text-xs">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
          Изучите что-нибудь сегодня, чтобы сохранить серию!
        </div>
      )}

      {/* Multiplier Badge */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-border">
        {streakInfo.current_multiplier && streakInfo.current_multiplier > 1.0 ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded text-sm w-fit">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                {streakInfo.current_multiplier}x Boost
              </span>
            </div>
            {streakInfo.next_multiplier_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-1">
                 Next: {((streakInfo.current_multiplier || 1) + 0.1).toFixed(1)}x at {streakInfo.next_multiplier_at} days
              </p>
            )}
          </div>
        ) : (
           <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1">
             <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
             Reach 5 days to unlock <span className="font-semibold text-indigo-600 dark:text-indigo-400">1.1x Point Boost!</span>
           </div>
        )}
      </div>
    </div>
  );
};

export default StreakDisplay;
