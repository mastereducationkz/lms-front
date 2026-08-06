import { useState } from 'react';
import { cn } from '../lib/utils';
import CuratorLeaderboardPage from './CuratorLeaderboardPage';
import SubstitutionAttendancePanel from './SubstitutionAttendancePanel';

// Teacher-facing attendance: the shared leaderboard grid plus the
// substitution-lessons panel behind one toggle. Curators keep using
// /curator/leaderboard directly.
export default function AttendancePage() {
  const [view, setView] = useState<'leaderboard' | 'substitutions'>('leaderboard');

  return (
    <div>
      <div className="px-8 pt-6">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-border p-0.5 bg-gray-50 dark:bg-secondary">
          {([['leaderboard', 'Лидерборд'], ['substitutions', 'Substitutions']] as const).map(([key, label]) => (
            <button
              key={key}
              className={cn(
                'px-4 py-1.5 text-sm font-semibold rounded-md transition-colors',
                view === key
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              )}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={view === 'substitutions' ? '' : 'hidden'}>
        <div className="m-8 border border-gray-200 dark:border-border rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
          <SubstitutionAttendancePanel />
        </div>
      </div>
      <div className={view === 'leaderboard' ? '' : 'hidden'}>
        <CuratorLeaderboardPage />
      </div>
    </div>
  );
}
