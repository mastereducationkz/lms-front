/**
 * The dashboard's Halloween greeting (owner, 2026-10-26): a warm hello by first name, the hunt's
 * five pumpkins and how many are found, the card once all five are, and the way out. Closing it
 * hides it until tomorrow (Almaty date); turning decorations off hides everything on this device.
 */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { firstName } from '@/lib/personNames';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/seasonal';
import { useSeason } from '../SeasonProvider';
import { Bat, Ghost, Moon, Pumpkin } from './art';
import { HUNT_SIZE } from './hunt';
import { openFinale, storage, useFound } from './state';
import TrickOrTreat from './TrickOrTreat';

const CLOSED_KEY = 'seasonal:halloween-2026:greeting-closed';

/** Today in Almaty, as YYYY-MM-DD. */
function almatyToday(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

function closedToday(): boolean {
  try {
    return storage()?.getItem(CLOSED_KEY) === almatyToday();
  } catch {
    return false;
  }
}

/** The night panel on the greeting's right. */
function NightScene() {
  return (
    <div aria-hidden className="relative hidden h-full min-h-[140px] w-[220px] shrink-0 overflow-hidden rounded-lg bg-[#1E1433] @2xl:block">
      <Moon size={86} className="absolute right-5 top-4" />
      <Bat size={40} className="absolute right-[38px] top-[34px] -rotate-12" />
      <Bat size={30} color="#6D5A99" className="absolute left-6 top-5 rotate-6" />
      <Bat size={22} color="#6D5A99" className="absolute left-[92px] top-12 -rotate-6" />
      <Ghost size={52} className="absolute bottom-3 left-5" />
      <Pumpkin size={44} className="absolute bottom-2 right-14" />
      <Pumpkin size={32} plain className="absolute bottom-2 right-4" />
    </div>
  );
}

export default function Greeting() {
  const t = useT();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { setEnabled } = useSeason();
  const found = useFound(user?.id);
  const [closed, setClosed] = useState(closedToday);

  if (!user || pathname !== '/dashboard' || closed) return null;

  const name = firstName(user.name);
  const count = Math.min(found.length, HUNT_SIZE);
  const complete = count >= HUNT_SIZE;
  const close = () => {
    setClosed(true);
    try {
      storage()?.setItem(CLOSED_KEY, almatyToday());
    } catch {
      // Private mode: closed for this visit.
    }
  };

  return (
    <section
      aria-labelledby="hw-greeting-title"
      className="relative mb-5 flex gap-5 rounded-xl border border-brand-border bg-brand-surface p-4 text-brand-surface-foreground sm:mb-6 sm:p-5"
    >
      <div className="relative min-w-0 flex-1 pr-9">
        <h2 id="hw-greeting-title" className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
          {/* On phones the top bar has no room for it, so the trick-or-treat pumpkin lives here. */}
          <TrickOrTreat className="flex h-9 w-9 shrink-0 sm:hidden" size={22} />
          <Ghost size={26} className="hidden shrink-0 sm:block @2xl:hidden" />
          {name ? t('seasonal.halloween.greeting.title', { name }) : t('seasonal.halloween.greeting.titleNoName')}
        </h2>
        <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed">
          {t(complete ? 'seasonal.halloween.greeting.done' : 'seasonal.halloween.greeting.body')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1 text-brand-subtle-foreground">
            {Array.from({ length: HUNT_SIZE }, (_, i) => (
              <Pumpkin key={i} size={24} plain={i >= count} hollow={i >= count} />
            ))}
          </span>
          <span className="text-sm font-medium tabular-nums">{t('seasonal.halloween.greeting.progress', { count })}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {complete && (
            <button
              type="button"
              onClick={() => openFinale('card')}
              className="rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-brand-solid-foreground transition-colors hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('seasonal.halloween.greeting.card')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className="rounded text-sm font-medium text-brand-subtle-foreground underline underline-offset-4 transition-colors hover:text-brand-surface-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('seasonal.halloween.greeting.turnOff')}
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          className="absolute -right-1.5 -top-1.5 rounded-lg p-1.5 text-brand-subtle-foreground transition-colors hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('seasonal.halloween.greeting.close')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <NightScene />
    </section>
  );
}
