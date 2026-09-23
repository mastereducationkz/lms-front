import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { buildCrmTasksUrl } from '../lib/crmLinks';

/**
 * `/curator/tasks` and `/curator/onboarding` live in the CRM now, as «Задачи».
 *
 * The LMS task board and the onboarding board were retired (2026-09-23): curator work is one
 * list in the CRM, next to the client card, freezes and groups. Old bookmarks land here and
 * are sent on, replacing the history entry so Back does not bounce between the two apps.
 */
export default function CuratorTasksRedirect() {
  const location = useLocation();
  const target = useMemo(() => buildCrmTasksUrl(location.search), [location.search]);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Задачи кураторов теперь в CRM
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        Заморозки, ОС, первые и последние уроки, даты и результаты экзаменов — один список в
        CRM. Вход по той же учётной записи.
      </p>
      <a
        href={target}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Перейти к задачам
      </a>
      <p className="text-xs text-gray-500">
        Если переход не произошёл автоматически, нажмите кнопку выше.
      </p>
    </div>
  );
}
