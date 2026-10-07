import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { parseAsUTC } from '../../lib/datetime';
import { Clock } from 'lucide-react';
import { t as translate, type Locale } from '../../lib/i18n';
import { useLocale } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

function formatRemaining(ms: number, locale: Locale): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0
    ? translate('studentHome.trial.hoursMinutes', { hours: h, minutes: m }, locale)
    : translate('studentHome.trial.minutes', { minutes: m }, locale);
}

const TrialBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const locale = useLocale();

  // trial_expires_at is a naive-UTC string from the backend — parseAsUTC, not new Date(),
  // or the countdown drifts by the browser's UTC offset.
  const deadline = user?.is_trial && user?.trial_expires_at
    ? parseAsUTC(user.trial_expires_at).getTime()
    : null;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // No active trial deadline for this user: render nothing and set up no timers.
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    // When the countdown hits zero, refetch the user: trial_expires_at disappears
    // (or the trial flips to expired) and ProtectedRoute's gate switches to the
    // expired panel.
    if (deadline && now >= deadline) refreshUser();
  }, [deadline, now, refreshUser]);

  if (!deadline || now >= deadline) return null;

  return (
    <div className="w-full bg-amber-500 text-white text-sm px-4 py-1.5 flex items-center justify-center gap-2">
      <Clock className="w-4 h-4" />
      <span>{translate('studentHome.trial.endsIn', { time: formatRemaining(deadline - now, locale) }, locale)}</span>
    </div>
  );
};

export default TrialBanner;
