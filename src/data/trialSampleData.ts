// Placeholder content shown ONLY to trial users (user.is_trial) in dashboard
// sections that would otherwise be permanently empty for them — trial
// accounts get course access via a TrialAccess grant, not group/enrollment
// rows, so group-scoped widgets (weekly sessions, todo deadlines) never have
// real data to show. Always rendered alongside <SampleBadge />.
// Frontend-only static data — never sent to or fetched from the backend, and
// never substituted for the prospect's real trial course or real progress.

export interface TrialSampleSession {
  id: number;
  title: string;
  day: string;
  time: string;
}

export const TRIAL_SAMPLE_SESSIONS: TrialSampleSession[] = [
  { id: -1, title: 'Speaking club — Intermediate', day: 'Mon', time: '18:00–19:00' },
  { id: -2, title: 'Grammar workshop', day: 'Wed', time: '19:00–20:00' },
  { id: -3, title: 'IELTS Writing office hours', day: 'Fri', time: '17:00–18:00' },
];

export interface TrialSampleTask {
  id: number;
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeClassName: string;
}

export const TRIAL_SAMPLE_TASKS: TrialSampleTask[] = [
  {
    id: -1,
    title: 'Vocabulary quiz: Unit 3',
    subtitle: 'Due in 2 days',
    badgeLabel: 'due soon',
    badgeClassName: 'bg-yellow-100 text-yellow-800',
  },
  {
    id: -2,
    title: 'Speaking club — Intermediate',
    subtitle: 'Mon 18:00',
    badgeLabel: 'webinar',
    badgeClassName: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    id: -3,
    title: 'Essay: My favorite hobby',
    subtitle: 'Due in 5 days',
    badgeLabel: 'pending',
    badgeClassName: 'bg-gray-100 text-gray-800',
  },
];
