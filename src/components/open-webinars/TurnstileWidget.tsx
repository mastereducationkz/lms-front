import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Locale } from '../../lib/i18n/locale';
import type { TFunction } from '../../lib/i18n/translate';
import '@/lib/i18n/catalogs/openWebinars';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** The part of Cloudflare's `window.turnstile` this page uses. */
interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    theme: 'auto' | 'light' | 'dark';
    language: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
const turnstileApi = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

/**
 * The site key the build was given (`VITE_TURNSTILE_SITE_KEY`; public by design), or '' while there is none. Read on
 * every call, never cached: with no key the forms show no check, send no token and never wait for one.
 */
export const turnstileSiteKey = (): string => String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();

let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once, however many forms are on the page; a failed load can be tried again by the next widget. */
function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true, defer: true });
    const fail = (reason: string) => { script.remove(); loading = null; reject(new Error(reason)); };
    script.addEventListener('load', () => {
      const loaded = turnstileApi();
      if (loaded) { loading = null; resolve(loaded); } else fail('turnstile did not start');
    });
    script.addEventListener('error', () => fail('turnstile failed to load'));
    if (!existing) document.head.appendChild(script);
  });
  return loading;
}

export interface TurnstileHandle {
  /** A token is good for one submit: ask for a fresh one (and forget the spent one) after every attempt that reached the server. */
  reset: () => void;
}

interface Props {
  siteKey: string;
  locale: Locale;
  t: TFunction;
  /** The current token, or null while there is none (not solved yet, expired, errored, reset). */
  onToken: (token: string | null) => void;
}

/** Cloudflare Turnstile, rendered explicitly into its own box. Mount it only when there is a site key. */
const TurnstileWidget = forwardRef<TurnstileHandle, Props>(function TurnstileWidget({ siteKey, locale, t, onToken }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const latest = useRef(onToken);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { latest.current = onToken; });

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) turnstileApi()?.reset(widgetId.current);
      latest.current(null);
    },
  }), []);

  // The widget speaks the page's language, so it is drawn again when the visitor switches.
  useEffect(() => {
    let cancelled = false;
    setUnavailable(false);
    loadTurnstile().then((turnstile) => {
      if (cancelled || !host.current) return;
      widgetId.current = turnstile.render(host.current, {
        sitekey: siteKey,
        theme: 'auto',
        language: locale,
        callback: (token) => latest.current(token),
        'expired-callback': () => latest.current(null),
        'error-callback': () => latest.current(null),
      });
    }).catch(() => { if (!cancelled) setUnavailable(true); });
    return () => {
      cancelled = true;
      if (widgetId.current !== null) turnstileApi()?.remove(widgetId.current);
      widgetId.current = null;
      latest.current(null);
    };
  }, [siteKey, locale]);

  return (
    <div>
      <div ref={host} data-turnstile />
      {unavailable && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t('openWebinars.captcha.loadFailed')}</p>}
    </div>
  );
});

export default TurnstileWidget;
