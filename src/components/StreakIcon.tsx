import React, { useEffect, useState, useRef } from 'react';
import { DailyStreakInfo } from '../types';
import { getDailyStreak } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ShineBorder } from './magicui/shine-border';

const StreakIcon: React.FC = () => {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<DailyStreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'student') {
      loadStreakData();
    }
  }, [user]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const loadStreakData = async () => {
    try {
      setIsLoading(true);
      const data = await getDailyStreak();
      setStreakData(data);
    } catch (error) {
      console.error('Failed to load streak data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStreakColor = () => {
    switch (streakData?.streak_status) {
      case 'active':
        return 'bg-white dark:bg-card text-orange-500';
      case 'at_risk':
        return 'bg-white dark:bg-card text-yellow-500';
      case 'broken':
        return 'bg-white dark:bg-card text-gray-400';
      case 'not_started':
        return 'bg-white dark:bg-card text-gray-400';
      default:
        return 'bg-white dark:bg-card text-gray-400';
    }
  };

  const getShineColor = () => {
    switch (streakData?.streak_status) {
      case 'active':
        return ['#f97316', '#fb923c'];
      case 'at_risk':
        return ['#eab308', '#facc15', '#fde047'];
      case 'broken':
        return ['#9ca3af', '#d1d5db', '#f3f4f6'];
      case 'not_started':
        return ['#d1d5db', '#e5e7eb', '#f9fafb'];
      default:
        return ['#d1d5db', '#e5e7eb', '#f9fafb'];
    }
  };

  const getStreakIcon = () => {
    switch (streakData?.streak_status) {
      case 'active':
        return '🔥';
      case 'at_risk':
        return '⚠️';
      case 'broken':
        return '🫥';
      case 'not_started':
        return '🎯';
      default:
        return '🎯';
    }
  };

  const getTooltipText = () => {
    switch (streakData?.streak_status) {
      case 'active':
        return `${streakData.daily_streak} day streak! Keep it up!`;
      case 'at_risk':
        return `${streakData.daily_streak} day streak at risk. Study today to maintain it!`;
      case 'broken':
        return 'Streak broken. Start a new one today!';
      case 'not_started':
        return 'Start your learning streak today!';
      default:
        return 'Daily learning streak';
    }
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Create array of days
    const days: Array<{ date: number; isActive: boolean; isToday: boolean; isPast: boolean }> = [];
    
    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: 0, isActive: false, isToday: false, isPast: false });
    }
    
    const streakCount = streakData?.daily_streak || 0;
    const todayDate = today.getDate();
    
    // Add actual days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === todayDate;
      const isPast = day < todayDate;
      const daysAgo = todayDate - day;
      
      // Mark days as active based on streak count
      // Show the last N days as active, where N = streak count
      let isActive = false;
      if (streakCount > 0) {
        // If today is active, mark it
        if (isToday && streakData?.is_active_today) {
          isActive = true;
        }
        // Mark past days within the streak range
        // For a 2-day streak: today (if active) + yesterday
        else if (isPast && daysAgo > 0 && daysAgo <= streakCount) {
          isActive = true;
        }
      }
      
      days.push({ date: day, isActive, isToday, isPast });
    }
    
    return {
      days,
      monthName: new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  };

  // Don't show for non-students
  if (!user || user.role !== 'student') {
    return null;
  }

  // Don't show while loading or if no data
  if (isLoading || !streakData) {
    return null;
  }

  const { days, monthName } = generateCalendarDays();

  return (
    <div className="relative" ref={popoverRef} data-tour="streak-display">
      <div 
        className={`relative overflow-hidden w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 ${getStreakColor()}`}
        onClick={() => setShowCalendar(!showCalendar)}
      >
        <ShineBorder shineColor={getShineColor()} />
        <span className="relative z-10 text-2xl font-bold">
          {streakData.daily_streak > 0 ? streakData.daily_streak : getStreakIcon()}
        </span>
      </div>
      
      {/* Calendar Popover */}
      {showCalendar && (
        <div className="absolute top-full right-0 mt-2 bg-white dark:bg-card rounded-lg shadow-xl border border-gray-200 dark:border-border p-4 z-50 w-72">
          <div className="text-center mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-foreground">{monthName}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getTooltipText()}</p>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((day, idx) => {
              if (day.date === 0) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              
              let dayClasses = "aspect-square flex items-center justify-center text-sm rounded-md transition-colors ";
              
              if (day.isToday) {
                dayClasses += "ring-2 ring-blue-500 font-bold ";
              }
              
              if (day.isActive) {
                dayClasses += "bg-orange-500 text-white font-semibold ";
              } else if (day.isPast) {
                dayClasses += "text-gray-400 dark:text-gray-500 ";
              } else {
                dayClasses += "text-gray-700 dark:text-gray-300 ";
              }
              
              return (
                <div key={`day-${day.date}`} className={dayClasses}>
                  {day.date}
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Active days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-blue-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Today</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreakIcon;
