import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { CurrentLive } from '../../lib/liveLesson/types';
import { live } from '../../services/api/liveLesson';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

/**
 * «Live now» on the student dashboard (owner, 2026-09-29): shown only while the teacher has a question
 * open in the student's lesson; one tap to /live. Hides itself otherwise.
 */
export default function LiveNowTile() {
  const t = useT();
  const [current, setCurrent] = useState<CurrentLive | null>(null);
  useEffect(() => {
    let alive = true;
    const look = () => live.current().then((c) => { if (alive) setCurrent(c); }).catch(() => undefined);
    void look();
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') void look(); }, 45_000);
    return () => { alive = false; window.clearInterval(tick); };
  }, []);
  if (!current?.lesson || !current.activity) return null;
  return (
    <Link to="/live" className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
      <span className="relative flex h-3 w-3 flex-none">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t('studentHome.liveNow.title')}</span>
        <span className="block truncate text-xs opacity-80">{current.lesson.title}</span>
      </span>
      <span className="inline-flex flex-none items-center gap-0.5 text-sm font-semibold">{t('studentHome.liveNow.answer')}<ChevronRight className="h-4 w-4" aria-hidden /></span>
    </Link>
  );
}
