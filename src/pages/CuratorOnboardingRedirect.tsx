import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * `/curator/onboarding` now lives in the CRM.
 *
 * The CRM is the only interactive onboarding UI: it is where the financial data, the
 * student card and the identity live, and running a second editable board here would mean
 * two sources of truth for the same rows. Old bookmarks and any link still pointing at this
 * path therefore land on a redirect rather than a 404 or, worse, a stale board someone
 * keeps using.
 *
 * Query context is carried across — a curator who bookmarked their own filtered board keeps
 * it — and the redirect replaces the history entry so Back returns to wherever they came
 * from instead of bouncing between the two apps.
 */

const CRM_WEB_URL = (
  (import.meta.env.VITE_CRM_WEB_URL as string | undefined) ||
  'https://crm.mastereducation.kz'
).replace(/\/$/, '');

export function buildCrmOnboardingUrl(search: string): string {
  const incoming = new URLSearchParams(search);
  const outgoing = new URLSearchParams();
  // Only forward parameters the CRM board understands; anything else would be noise in
  // the address bar of a screen that never asked for it.
  for (const key of ['curator_id', 'card', 'status'] as const) {
    const value = incoming.get(key);
    if (value) outgoing.set(key, value);
  }
  const query = outgoing.toString();
  return `${CRM_WEB_URL}/curator/onboarding${query ? `?${query}` : ''}`;
}

export default function CuratorOnboardingRedirect() {
  const location = useLocation();
  const target = useMemo(() => buildCrmOnboardingUrl(location.search), [location.search]);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Онбординг переехал в CRM
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        Работа с онбордингом теперь ведётся в CRM — там же карточка клиента, оплаты и
        группы. Вход по той же учётной записи.
      </p>
      <a
        href={target}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Перейти в CRM
      </a>
      <p className="text-xs text-gray-500">
        Если переход не произошёл автоматически, нажмите кнопку выше.
      </p>
    </div>
  );
}
