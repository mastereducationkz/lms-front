/**
 * Two small sections for the student's achievements page: the «Kasatik of the lesson» crowns
 * (each shareable), and the share links they've made — with views, and a way to turn one off.
 */
import { useEffect, useState } from 'react';
import { Crown as CrownIcon, Link2 } from 'lucide-react';
import { toast } from '@/components/Toast';
import { getMyCrowns, getMyShares, revokeShare, type Crown, type ShareLink } from '@/services/api/shares';
import { ShareCrownButton } from './ShareButtons';

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

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
      <ul className="grid gap-3 md:grid-cols-2">
        {crowns.map((c) => (
          <li key={c.event_id} className="flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
            <span aria-hidden className="text-2xl">👑</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.lesson_title || 'Live lesson'}</span>
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

export function MyShareLinks() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  useEffect(() => {
    getMyShares().then(setLinks).catch(() => setLinks([]));
  }, []);
  const live = links.filter((l) => l.live);
  if (live.length === 0) return null;
  const turnOff = (slug: string) => {
    revokeShare(slug)
      .then((off) => {
        setLinks((all) => all.map((l) => (l.slug === slug ? off : l)));
        toast('Link turned off.', 'success');
      })
      .catch((e: Error) => toast(e.message, 'error'));
  };
  return (
    <section className="space-y-3">
      <Heading icon={<Link2 className="h-4 w-4 text-[#2563EB]" aria-hidden />}>Your share links</Heading>
      <ul className="divide-y divide-border rounded-2xl border border-gray-200 dark:border-border bg-white dark:bg-card">
        {live.map((l) => (
          <li key={l.slug} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{l.title ?? 'Shared card'}</span>
            <span className="text-xs text-muted-foreground">
              {l.views} view{l.views === 1 ? '' : 's'} · until {SHORT.format(new Date(l.expires_at))}
            </span>
            <button type="button" onClick={() => turnOff(l.slug)} className="text-xs font-medium text-gray-500 hover:text-red-600">
              Turn off
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Anyone with a link can see that card until it expires or you turn it off.</p>
    </section>
  );
}
