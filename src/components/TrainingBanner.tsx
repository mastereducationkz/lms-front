import { useLocation } from 'react-router-dom';
import { TRAINING_BUILD } from '../lib/trainingBuild';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/trainingCopy';

const env = import.meta.env;

/**
 * «ТРЕНАЖЁР · учебная копия · сообщения никуда не уходят · commit», always on screen in the training build, so nobody mistakes
 * the practice copy for the real LMS (docs/training/CONTRACTS.md §6.6). Production builds never set VITE_APP_ENV=training: nothing renders.
 * Not on /training-login: that page says what it is itself, and nobody is signed in there yet. Without a build commit the
 * sentence simply ends (never «unknown»). The words follow the signed-in person's language like everything else.
 */
export default function TrainingBanner() {
  const t = useT();
  const { pathname } = useLocation();
  if (!TRAINING_BUILD || pathname.startsWith('/training-login')) return null;
  const commit = ((env.VITE_STAGING_COMMIT as string | undefined) || '').slice(0, 7);
  const label = commit ? t('trainingCopy.banner', { commit }) : t('trainingCopy.bannerNoCommit');
  return (
    <div
      role="status"
      data-training-banner
      aria-label={label}
      className="pointer-events-none fixed bottom-2 left-1/2 z-[10000] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 select-none rounded-2xl bg-amber-500/95 px-3 py-1 text-center font-mono text-xs font-semibold leading-tight text-black shadow-lg"
    >
      {label}
    </div>
  );
}
