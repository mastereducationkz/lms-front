// Day and unread separators for the message list, ported from the mobile client.

export function isSameDay(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// The app has no language switch, so dates follow the browser locale like the rest of
// ChatPage's `toLocaleDateString()`/`toLocaleTimeString()` calls. "Today"/"Yesterday"
// come from Intl.RelativeTimeFormat so they are localized too rather than hardcoded.
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateSeparator(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return capitalize(relative.format(0, 'day'));
  if (messageDate.getTime() === yesterday.getTime()) return capitalize(relative.format(-1, 'day'));

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (messageDate.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString(undefined, options);
}

/** Message timestamp inside a bubble — always the time of day, since the day is
 * carried by the separator above the group. */
export function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-3 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        {label}
      </span>
    </div>
  );
}

export function UnreadDivider() {
  return (
    <div className="flex items-center gap-2 my-3" role="separator" aria-label="Unread messages">
      <span className="h-px flex-1 bg-red-400" />
      <span className="text-[11px] font-semibold uppercase text-red-500">Unread messages</span>
      <span className="h-px flex-1 bg-red-400" />
    </div>
  );
}
