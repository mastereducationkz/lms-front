/** The «Kasatik of the lesson» crowns on the student's achievements page, each shareable. */
import { useEffect, useState } from 'react';
import { Crown as CrownIcon } from 'lucide-react';
import { getMyCrowns, type Crown } from '@/services/api/shares';
import { ShareCrownButton } from './ShareButtons';

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Heading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

export function CrownsSection() {
  const [crowns, setCrowns] = useState<Crown[]>([]);
  useEffect(() => {
    getMyCrowns().then(setCrowns).catch(() => setCrowns([]));
  }, []);
  if (crowns.length === 0) return null;
  return (
    <section className="space-y-3">
      <Heading icon={<CrownIcon className="h-4 w-4 text-amber-500" aria-hidden />}>Kasatik of the lesson</Heading>
      <ul className="grid gap-3 @lg:grid-cols-2">
        {crowns.map((c) => (
          <li key={c.event_id} className="flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
            <CrownIcon className="h-6 w-6 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{c.lesson_title || 'Live lesson'}</span>
              <span className="block text-xs text-muted-foreground">
                {c.lesson_date ? DAY.format(new Date(`${c.lesson_date}T00:00:00Z`)) : ''}
              </span>
            </span>
            <ShareCrownButton crown={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}
