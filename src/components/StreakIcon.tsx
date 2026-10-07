import React, { useEffect, useId, useState } from 'react';
import { DailyStreakInfo } from '../types';
import { getDailyStreak } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ShineBorder } from './magicui/shine-border';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import './StreakIcon.css';

type FlameState = 'lit' | 'flicker' | 'out';

/**
 * The streak's flame. With a count it perches on the square's top-right corner: lively while
 * the streak is active, burning low and slow while it is at risk, static grey once it is out.
 * With no count (streak 0) it stands unlit in the middle of the square. prefers-reduced-motion
 * keeps it still. Two layers (body + core) flicker on their own clocks; whole-element
 * transforms keep the animation on the compositor.
 */
function StreakFlame({ state, solo }: { state: FlameState; solo: boolean }) {
  return (
    <span aria-hidden="true" className={`streak-flame streak-flame--${state}${solo ? ' streak-flame--solo' : ''}`}>
      <svg viewBox="0 0 24 24" className="streak-flame__body">
        <path d="M12 1.6c.6 3.1 2.8 5 4.7 7 1.9 2 2.9 4.2 2.9 6.6 0 4.2-3.4 7.4-7.6 7.4s-7.6-3.2-7.6-7.4c0-2.5 1.1-4.5 2.8-5.8.1 1.7.8 2.9 1.9 3.5-.2-4 1-8 2.9-11.3z" />
      </svg>
      {!solo && (
        <svg viewBox="0 0 24 24" className="streak-flame__core">
          <path d="M12.3 11.4c.6 2 2.3 3.2 2.9 5.2.7 2.3-.6 4.6-3.2 4.6-2.4 0-3.6-1.7-3.3-3.6.2-1.3 1.1-2.2 1.8-2.9.3.8.7 1.3 1.2 1.5-.2-1.7 0-3.3.6-4.8z" />
        </svg>
      )}
    </span>
  );
}

const StreakIcon: React.FC = () => {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<DailyStreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (user?.role === 'student') {
      loadStreakData();
    }
  }, [user]);

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
        return 'bg-card text-orange-600 dark:text-orange-400';
      case 'at_risk':
        return 'bg-card text-amber-600 dark:text-amber-400';
      case 'broken':
        return 'bg-card text-muted-foreground';
      case 'not_started':
        return 'bg-card text-muted-foreground';
      default:
        return 'bg-card text-muted-foreground';
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

  const getFlameState = (): FlameState => {
    switch (streakData?.streak_status) {
      case 'active':
        return 'lit';
      case 'at_risk':
        return 'flicker';
      default:
        return 'out';
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
    const toDateKey = (value: Date) =>
      `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;

    const parseDateOnly = (value?: string | Date | null): Date | null => {
      if (!value) return null;
      if (value instanceof Date) return value;
      const [year, month, day] = value.split('-').map(Number);
      if (!year || !month || !day) return null;
      return new Date(year, month - 1, day);
    };

    const activeDateKeys = new Set<string>();
    const lastActivityDate = parseDateOnly(streakData?.last_activity_date);
    const anchorDate = streakData?.is_active_today ? today : lastActivityDate;

    if (streakCount > 0 && anchorDate) {
      for (let i = 0; i < streakCount; i++) {
        const activeDay = new Date(anchorDate);
        activeDay.setDate(anchorDate.getDate() - i);
        activeDateKeys.add(toDateKey(activeDay));
      }
    }
    
    // Add actual days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === todayDate;
      const isPast = day < todayDate;
      const dayDate = new Date(currentYear, currentMonth, day);
      const isActive = activeDateKeys.has(toDateKey(dayDate));
      
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
  const flame = getFlameState();
  const hasCount = streakData.daily_streak > 0;

  return (
    <div className="relative" data-tour="streak-display">
      <Popover open={showCalendar} onOpenChange={setShowCalendar}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`relative overflow-hidden w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${getStreakColor()}`}
            aria-label={getTooltipText()}
          >
            <ShineBorder shineColor={getShineColor()} className="motion-reduce:!animate-none" />
            {hasCount ? (
              <span className="relative z-10 text-2xl font-bold tabular-nums">{streakData.daily_streak}</span>
            ) : (
              <StreakFlame state={flame} solo />
            )}
          </button>
        </PopoverTrigger>
        {hasCount && <StreakFlame state={flame} solo={false} />}

        {/* Portalled to <body> (Radix): the Topbar's sticky z-10 layer no longer caps it, so later
            z-10 blocks and the countdown's 3D flip tiles can't paint over the calendar, and
            collision padding keeps it on screen at every width. */}
        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-labelledby={titleId}
          className="w-[min(18rem,calc(100vw-1rem))] rounded-lg p-4 shadow-xl"
        >
          <div className="text-center mb-3">
            <h3 id={titleId} className="font-semibold text-foreground">{monthName}</h3>
            <p className="text-sm text-muted-foreground mt-1">{getTooltipText()}</p>
            {typeof streakData.longest_streak === 'number' && streakData.longest_streak > 0 && (
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mt-1">
                Best streak: {streakData.longest_streak} day{streakData.longest_streak === 1 ? '' : 's'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Your streak counts days you learn: a finished step, homework, a lesson attended, a live answer or a weekly test.
            </p>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs font-medium text-muted-foreground text-center py-1">
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
                dayClasses += "ring-2 ring-ring dark:ring-brand font-bold ";
              }
              
              if (day.isActive) {
                dayClasses += "bg-orange-500 text-white font-semibold ";
              } else if (day.isPast) {
                dayClasses += "text-gray-400 dark:text-muted-foreground ";
              } else {
                dayClasses += "text-gray-700 dark:text-foreground ";
              }
              
              return (
                <div key={`day-${day.date}`} className={dayClasses}>
                  {day.date}
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <span className="text-muted-foreground">Active days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-ring dark:ring-brand"></div>
              <span className="text-muted-foreground">Today</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default StreakIcon;
