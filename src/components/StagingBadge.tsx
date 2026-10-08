/**
 * «STAGING · branch · commit», always on screen in a staging build (docs/infra/STAGING.md), so
 * nobody mistakes the stand for production. The deploy workflow bakes the branch and commit in
 * (VITE_STAGING_BRANCH / VITE_STAGING_COMMIT); production builds never set VITE_APP_ENV=staging,
 * so there this renders nothing.
 */
const env = import.meta.env;

export default function StagingBadge() {
  if (env.VITE_APP_ENV !== 'staging') return null;
  const branch = (env.VITE_STAGING_BRANCH as string | undefined) || 'unknown';
  const commit = ((env.VITE_STAGING_COMMIT as string | undefined) || 'unknown').slice(0, 7);
  return (
    <div
      role="status"
      aria-label={`Staging: ${branch} ${commit}`}
      className="pointer-events-none fixed bottom-2 left-1/2 z-[10000] -translate-x-1/2 select-none whitespace-nowrap rounded-full bg-red-600/90 px-3 py-1 font-mono text-xs font-semibold text-white shadow-lg"
    >
      STAGING · {branch} · {commit}
    </div>
  );
}
