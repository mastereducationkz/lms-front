import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../lib/i18n/react';
import { redeemTrainingLink } from '../../services/api/trainingCopy';
import '@/lib/i18n/catalogs/trainingCopy';

/**
 * /training-login?t=<jwt> (training build only): the one-click sign-in from «Открыть тренажёр» in the production LMS.
 * Spends the single-use link at once, takes the token out of the address bar first, and on success signs in as the
 * password login would. Every failure shows the same sentence; never a password form.
 */
export default function TrainingLoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [params] = useSearchParams();
  // Read once: the address bar is cleaned below, and StrictMode renders twice.
  const [token] = useState(() => params.get('t'));
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      window.history.replaceState(null, '', window.location.pathname);
      if (!token) {
        setFailed(true);
      } else {
        redeemTrainingLink(token)
          .then(({ user, path }) => {
            updateUser(user);
            navigate(path, { replace: true });
          })
          .catch(() => { if (mounted.current) setFailed(true); });
      }
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      {failed ? (
        <>
          <p role="alert" className="max-w-md text-sm text-destructive">{t('trainingCopy.login.expired')}</p>
          <p className="text-xs text-muted-foreground">{t('trainingCopy.login.expiredHint')}</p>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('trainingCopy.login.signingIn')}</p>
        </>
      )}
    </div>
  );
}
