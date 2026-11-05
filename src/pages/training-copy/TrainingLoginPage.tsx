import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { deviceLocale, type Locale } from '../../lib/i18n/locale';
import { t as translate, type TFunction } from '../../lib/i18n/translate';
import { redeemTrainingLink } from '../../services/api/trainingCopy';
import TrainingLoader from '@/components/training/TrainingLoader';
import { Button } from '@/components/ui/button';
import '@/lib/i18n/catalogs/trainingCopy';

/** Nobody is signed in yet: this device's last language, else the browser's (a Russian browser reads Russian). */
function pageLocale(): Locale {
  const navigatorLanguage = typeof navigator === 'undefined' ? '' : (navigator.language ?? '').toLowerCase();
  return deviceLocale() ?? (navigatorLanguage.startsWith('ru') ? 'ru' : 'en');
}

/**
 * /training-login?t=<jwt> (training build only): the one-click sign-in from «Открыть тренажёр» in the production LMS.
 * Spends the single-use link at once, takes the token out of the address bar first, and on success signs in as the
 * password login would. Every failure shows the same sentence; never a password form.
 */
export default function TrainingLoginPage() {
  const [locale] = useState(pageLocale);
  const t: TFunction = (key, params) => translate(key, params, locale);
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [params] = useSearchParams();
  // Read once: the address bar is cleaned below, and StrictMode renders twice.
  const [token] = useState(() => params.get('t'));
  // null = loading; 'expired' = the server refused the link (used or too old); 'unreachable' = no answer, try again.
  const [failure, setFailure] = useState<null | 'expired' | 'unreachable'>(null);
  const started = useRef(false);
  const mounted = useRef(true);

  const redeem = () => {
    if (!token) { setFailure('expired'); return; }
    setFailure(null);
    document.title = t('trainingCopy.login.pageTitleOpening');
    redeemTrainingLink(token)
      .then(({ user, path }) => {
        updateUser(user);
        document.title = t('trainingCopy.login.pageTitleReady');
        navigate(path, { replace: true });
      })
      .catch((e) => {
        if (!mounted.current) return;
        // The server answers every refusal with one 401; no answer or a 5xx did not spend the link, so trying again can work.
        const status = (e as { response?: { status?: number } })?.response?.status;
        document.title = t('trainingCopy.login.pageTitleError');
        setFailure(status === undefined || status >= 500 ? 'unreachable' : 'expired');
      });
  };

  useEffect(() => {
    mounted.current = true;
    document.title = t('trainingCopy.login.pageTitleOpening');
    if (!started.current) {
      started.current = true;
      window.history.replaceState(null, '', window.location.pathname);
      redeem();
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failure === null) {
    return <TrainingLoader state="loading" heading={t('trainingCopy.login.signingIn')} hint={t('trainingCopy.login.hint')} />;
  }
  const expired = failure === 'expired';
  return (
    <TrainingLoader
      state="error"
      heading={t('trainingCopy.login.errorHeading')}
      error={expired ? t('trainingCopy.login.expired') : t('trainingCopy.login.failed')}
      hint={expired ? t('trainingCopy.login.expiredHint') : t('trainingCopy.login.hint')}
      actions={expired
        ? <Button onClick={() => window.close()}>{t('trainingCopy.login.close')}</Button>
        : <Button onClick={redeem}>{t('trainingCopy.login.retry')}</Button>}
    />
  );
}
