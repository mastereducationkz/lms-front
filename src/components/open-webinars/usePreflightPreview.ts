import { useEffect, useState } from 'react';
import { preflightOpenAccess, type PreflightBody } from '../../services/api/openWebinars';

/** How long the form must sit still before the server is asked, so typing a title does not fire a request per letter. */
export const PREFLIGHT_DELAY_MS = 400;

export interface PreflightPreview {
  /** The address that WILL be used, once the server has said so for the current fields. */
  slug: string | null;
  /** The server's refusal for the current fields, in the reader's language. */
  error: string | null;
  checking: boolean;
}

/**
 * Asks the server what opening this webinar to everyone would do — before any event exists — and keeps the
 * answer only for the fields it was asked about: a slow reply to an earlier version of the form is dropped.
 * `body` null means the form cannot be checked yet (no pipeline, no title, no valid time span, a series).
 */
export function usePreflightPreview(body: PreflightBody | null, delayMs = PREFLIGHT_DELAY_MS): PreflightPreview {
  const key = body ? JSON.stringify(body) : null;
  const [answer, setAnswer] = useState<{ key: string; slug: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let live = true;
    const timer = window.setTimeout(() => {
      preflightOpenAccess(JSON.parse(key) as PreflightBody)
        .then((done) => live && setAnswer({ key, slug: done.slug, error: null }))
        .catch((failure) => live && setAnswer({ key, slug: null, error: failure instanceof Error ? failure.message : 'Failed to check the public access' }));
    }, delayMs);
    return () => { live = false; window.clearTimeout(timer); };
  }, [key, delayMs]);

  const current = key && answer?.key === key ? answer : null;
  return { slug: current?.slug ?? null, error: current?.error ?? null, checking: !!key && !current };
}
