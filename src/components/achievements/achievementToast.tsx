/** The quiet way to announce a new achievement: a small toast, and tapping it opens the card. */
import { Trophy } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { activeLocale, t, type Locale } from '@/lib/i18n';
import '@/lib/i18n/catalogs/studentHome';

export function showAchievementToast(title: string, onOpen: () => void, locale: Locale = activeLocale()): void {
  sonnerToast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          sonnerToast.dismiss(id);
          onOpen();
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-left text-sm shadow-lg transition-colors hover:bg-muted"
      >
        <Trophy className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <span className="min-w-0">
          {t('studentHome.achievements.toastLead', undefined, locale)} <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground">{t('studentHome.achievements.toastTap', undefined, locale)}</span>
        </span>
      </button>
    ),
    { duration: 7000 },
  );
}
