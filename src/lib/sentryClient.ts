/**
 * The part of `@sentry/react` the app uses, and the only static import of it.
 *
 * `src/lib/sentry.ts` loads this module with a dynamic import. Importing the SDK namespace
 * dynamically would keep all of it (replay, tracing, feedback: ~160 KB gzipped). Naming the
 * four functions here lets Rollup drop the rest.
 */
export { captureException, init, setTag, setUser } from '@sentry/react';
