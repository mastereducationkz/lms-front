import { TRAINING_BUILD } from '../lib/trainingBuild';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/trainingCopy';

const env = import.meta.env;

/**
 * «ТРЕНАЖЁР · учебная копия · сообщения никуда не уходят · commit», always on screen in the training build, so nobody mistakes
 * the practice copy for the real LMS (docs/training/CONTRACTS.md §6.6). Production builds never set VITE_APP_ENV=training: nothing renders.
 */
export default function TrainingBanner() {
  const t = useT();
  if (!TRAINING_BUILD) return null;
  const commit = ((env.VITE_STAGING_COMMIT as string | undefined) || 'unknown').slice(0, 7);
  return (
    <div
      role="status"
      aria-label={t('trainingCopy.banner', { commit })}
      className="pointer-events-none fixed bottom-2 left-1/2 z-[10000] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 select-none rounded-2xl bg-amber-500/95 px-3 py-1 text-center font-mono text-xs font-semibold leading-tight text-black shadow-lg"
    >
      {t('trainingCopy.banner', { commit })}
    </div>
  );
}
