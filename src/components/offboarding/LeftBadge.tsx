import { AlertTriangle } from 'lucide-react';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

/**
 * «Teacher / curator left — reassign» on a running group whose teacher or curator account is
 * switched off (the server's `teacher_left` / `curator_left`, SPEC §12 Q93).
 */
export default function LeftBadge({ who }: { who: 'teacher' | 'curator' }) {
  const t = useT();
  return (
    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {t(who === 'teacher' ? 'offboarding.left.teacher' : 'offboarding.left.curator')}
    </span>
  );
}
