import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { materialsLocale, relativeTime, t } from '../lib/classMaterials';
import {
  CLASS_MATERIAL_NOTIFICATION_TYPES,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../services/api/notifications';

const POLL_MS = 60_000;
const LIST_LIMIT = 20;

/**
 * The Topbar's notifications bell (Task 15): unread count for class-materials notices
 * (`class_materials`, `class_material_removed`), and a popover listing them. Hidden for a
 * parent (D7: "parents see nothing") and while logged out.
 *
 * The unread count polls every 60s, but only while the tab is visible — a background tab
 * never fires the request, and coming back to the foreground refreshes immediately rather
 * than waiting out the rest of the interval.
 */
export default function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const locale = materialsLocale(user?.role);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const isParent = user?.role === 'parent';

  useEffect(() => {
    if (!user || isParent) return undefined;
    let cancelled = false;

    const loadCount = () => {
      if (document.visibilityState !== 'visible') return;
      getUnreadNotificationCount(CLASS_MATERIAL_NOTIFICATION_TYPES)
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => {
          /* a failed poll just tries again in 60s */
        });
    };

    loadCount();
    const interval = setInterval(loadCount, POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadCount();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, isParent]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoadingList(true);
    getNotifications(CLASS_MATERIAL_NOTIFICATION_TYPES)
      .then((res) => {
        if (!cancelled) setItems(res.slice(0, LIST_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!user || isParent) return null;

  const handleClick = (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
    markNotificationRead(n.id).catch(() => {});
    if (n.related_id != null) navigate(`/materials?lesson=${n.related_id}`);
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
    setItems((prev) => prev.map((it) => ({ ...it, is_read: true })));
    markAllNotificationsRead(CLASS_MATERIAL_NOTIFICATION_TYPES).catch(() => {});
  };

  const now = Date.now();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative w-9 h-9 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('notifications', locale)}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold text-foreground">{t('notifications', locale)}</span>
          {items.some((n) => !n.is_read) && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={handleMarkAllRead}
            >
              {t('markAllRead', locale)}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('noNotifications', locale)}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`block w-full px-3 py-2 text-left hover:bg-muted/50 ${n.is_read ? '' : 'bg-primary/5'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{n.title}</span>
                      <span className="flex-none text-[11px] text-muted-foreground">
                        {relativeTime(n.created_at, now, locale)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
