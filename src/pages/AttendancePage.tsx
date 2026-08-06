import { useState } from 'react';
import { cn } from '../lib/utils';
import CuratorLeaderboardPage from './CuratorLeaderboardPage';
import SubstitutionAttendancePanel from './SubstitutionAttendancePanel';

// Teacher-facing attendance: the shared leaderboard grid plus the
// substitution-lessons panel behind one toggle. Curators keep using
// /curator/leaderboard directly. Both views stay mounted (CSS-hidden)
// so unsaved leaderboard edits survive switching tabs.
export default function AttendancePage() {
  const [view, setView] = useState<'leaderboard' | 'substitutions'>('leaderboard');

  const toggle = (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-border p-0.5 bg-gray-50 dark:bg-secondary">
      {([['leaderboard', 'Leaderboard'], ['substitutions', 'Substitutions']] as const).map(([key, label]) => (
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
  );

  return (
    <div className="p-4 md:p-6">
      <div className={view === 'leaderboard' ? '' : 'hidden'}>
        <div className="p-4 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border">
          <CuratorLeaderboardPage embedded titleSlot={toggle} />
        </div>
      </div>
      <div className={view === 'substitutions' ? '' : 'hidden'}>
        <div className="p-4 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border space-y-4">
          <div className="border-b pb-4 dark:border-border">{toggle}</div>
          <SubstitutionAttendancePanel />
        </div>
      </div>
    </div>
  );
}
