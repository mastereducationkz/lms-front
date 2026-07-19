import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock } from 'lucide-react';

function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const TrialBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const deadline = user?.is_trial && user?.trial_expires_at
    ? new Date(user.trial_expires_at).getTime()
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
      <span>Trial access — ends in {formatRemaining(deadline - now)}</span>
    </div>
  );
};

export default TrialBanner;
