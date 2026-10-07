// Day and unread separators for the message list, ported from the mobile client.
import { activeLocale, formatDate, formatTime, t, type Locale } from '../../lib/i18n';
import '@/lib/i18n/catalogs/shell';

export function isSameDay(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// Dates follow the reader's UI language (lib/i18n), like the rest of the app.
export function formatDateSeparator(dateString: string, locale: Locale = activeLocale()) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return t('shell.chat.today', undefined, locale);
  if (messageDate.getTime() === yesterday.getTime()) return t('shell.chat.yesterday', undefined, locale);

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (messageDate.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return formatDate(date.getTime(), options, locale);
}

/** Message timestamp inside a bubble — always the time of day, since the day is
 * carried by the separator above the group. */
export function formatMessageTime(dateString: string, locale: Locale = activeLocale()) {
  return formatTime(new Date(dateString).getTime(), undefined, locale);
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="rounded-full bg-gray-200 dark:bg-secondary px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function UnreadDivider() {
  return (
    <div className="flex items-center gap-2 my-3" role="separator" aria-label={t('shell.chat.unread')}>
      <span className="h-px flex-1 bg-red-400 dark:bg-red-900" />
      <span className="text-[11px] font-semibold uppercase text-red-500 dark:text-red-400">{t('shell.chat.unread')}</span>
      <span className="h-px flex-1 bg-red-400 dark:bg-red-900" />
    </div>
  );
}
