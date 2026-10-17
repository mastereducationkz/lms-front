import { Info } from 'lucide-react';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/attendance';

/**
 * The line above the journal (owner, 2026-10-17): Google Meet marks attendance, the teacher gives the
 * activity scores, and a mark Meet got wrong can be corrected with a reason. Always shown, compact; the
 * second line only when Meet handed lessons back (`handedBack` > 0).
 */
export function AttendanceBanner({ handedBack }: { handedBack: number }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p>{t('attendance.banner.text')}</p>
        {handedBack > 0 && (
          <p className="font-semibold text-amber-800 dark:text-amber-300">{t('attendance.banner.handedBack', { count: handedBack })}</p>
        )}
      </div>
    </div>
  );
}

export default AttendanceBanner;
