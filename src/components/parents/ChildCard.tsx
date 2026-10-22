import { GraduationCap } from 'lucide-react';
import { ACCESS_CONTACT_HANDLE, ACCESS_CONTACT_URL } from '../../lib/accessEnding';
import { formatDateLong } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import type { ParentChild } from '../../services/api/parents';
import { ChildTargets } from './ChildTargets';
import '@/lib/i18n/catalogs/parent';

/**
 * One child on the parent dashboard. A child whose platform access ended (the CRM closed the
 * account) stays on the list with the day it ended and whom to write to — and nothing of their
 * studies: no group, no targets, and no request for their data.
 */
export function ChildCard({ child }: { child: ParentChild }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-brand-subtle flex items-center justify-center text-brand font-bold">
          {child.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground dark:text-foreground truncate">{child.name}</p>
          {!child.access_ended && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
              <GraduationCap className="w-4 h-4 shrink-0" />
              {child.group_name || t('parent.dashboard.noGroup')}
            </p>
          )}
        </div>
      </div>
      {child.access_ended ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-amber-300/80 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {t('parent.dashboard.accessEnded', { date: formatDateLong(child.access_until, locale) })}{' '}
          {t('parent.dashboard.accessEndedHint')}{' '}
          <a href={ACCESS_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline">
            {ACCESS_CONTACT_HANDLE}
          </a>
        </p>
      ) : (
        <ChildTargets studentId={child.id} />
      )}
    </div>
  );
}
