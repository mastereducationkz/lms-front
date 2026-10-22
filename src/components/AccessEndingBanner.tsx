import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  ACCESS_CONTACT_HANDLE,
  ACCESS_CONTACT_URL,
  accessBannerDays,
  accessBannerDismissedToday,
  dismissAccessBannerToday,
} from '../lib/accessEnding';
import { formatDateLong } from '../lib/i18n';
import { useLocale, useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/shell';

const localStore = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * A student's last 30 days of platform access: when it ends and whom to write to. The CRM sets the
 * day and closes the account; this only says so (`access_until` / `access_days_left` on /auth/me).
 * Hidden for the rest of the day with the cross, back tomorrow.
 */
export default function AccessEndingBanner() {
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const [hiddenNow, setHiddenNow] = useState(false);
  const days = accessBannerDays(user);
  if (!user || days === null || hiddenNow || accessBannerDismissedToday(localStore(), user.id)) return null;

  const hide = () => {
    setHiddenNow(true);
    dismissAccessBannerToday(localStore(), user.id);
  };

  return (
    <section
      role="status"
      className="relative mx-4 mt-3 sm:mx-5 md:mx-6 rounded-lg border border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <button
        type="button"
        onClick={hide}
        className="absolute right-2 top-2 z-10 rounded-md p-1 text-amber-800/80 transition-colors hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/60"
        aria-label={t('shell.access.dismiss')}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="px-3 py-2.5 pr-10 text-xs font-medium sm:px-4 sm:text-sm">
        {days === 0
          ? t('shell.access.lastDay')
          : t('shell.access.endsOn', { date: formatDateLong(user.access_until, locale) })}{' '}
        {t('shell.access.extend')}{' '}
        <a
          href={ACCESS_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:no-underline"
        >
          {ACCESS_CONTACT_HANDLE}
        </a>
      </p>
    </section>
  );
}
