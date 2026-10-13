/**
 * The personal Telegram link as a hook (Settings → Telegram and the Master League banner share it):
 * ask Support's status through the LMS, make a deep link on «Connect», and poll while the person
 * taps Start in the bot (also on coming back to the tab). The link is handed to the caller as a URL
 * to put in a real anchor, never opened by script, so no popup blocker eats it.
 */
import { useCallback, useEffect, useState } from 'react';
import { POLL_MS, isTelegramLink, telegramPhase, type TelegramPhase } from './telegramLink';
import { createTelegramLink, getTelegramStatus, unlinkTelegram, type TelegramStatus } from '../services/api/notificationCenter';

export interface TelegramLinkApi {
  status: TelegramStatus | null;
  phase: TelegramPhase;
  /** The t.me link made by «Connect», while waiting for Start. */
  link: { url: string; at: number } | null;
  busy: boolean;
  /** True when a link was made: false when the server did not answer with a real Telegram link. */
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
}

/** `enabled: false` asks nothing (a snoozed or already-connected banner makes no call). */
export function useTelegramLink(enabled = true): TelegramLinkApi {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState<{ url: string; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const phase = telegramPhase(status, link?.at ?? null, now);

  const check = useCallback(() => {
    getTelegramStatus()
      .then((s) => {
        setStatus(s);
        setNow(Date.now());
        if (s.linked) setLink(null);
      })
      .catch(() => setNow(Date.now()));
  }, []);
  useEffect(() => {
    if (enabled) check();
  }, [enabled, check]);

  // While waiting for Start: ask every few seconds, and at once when the person comes back.
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, check]);

  const connect = async () => {
    setBusy(true);
    try {
      const { deep_link } = await createTelegramLink();
      if (!isTelegramLink(deep_link)) throw new Error('not a Telegram link');
      setLink({ url: deep_link, at: Date.now() });
      setNow(Date.now());
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await unlinkTelegram());
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { status, phase, link, busy, connect, disconnect };
}
