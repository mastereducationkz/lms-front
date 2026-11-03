import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { toast } from '../../Toast';
import { useT } from '../../../lib/i18n/react';
import { fromDatetimeLocalKZ } from '../../../lib/datetime';
import { createTrialLink, updateTrialLink, type TrialLinkRow } from '../../../services/api/trialLinks';
import QrImage, { displayUrl } from '../QrImage';
import '@/lib/i18n/catalogs/trialLinks';

/** `YYYY-MM-DD` of a stored UTC moment, read in Almaty (the date input shows days, the server stores the moment). */
function almatyDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

function LinkCard({ link, onChanged }: { link: TrialLinkRow; onChanged: () => void }) {
  const t = useT();
  const [cap, setCap] = useState(link.signup_cap?.toString() ?? '');
  const [closes, setCloses] = useState(almatyDay(link.closes_at));

  const save = async (body: Parameters<typeof updateTrialLink>[1]) => {
    try {
      await updateTrialLink(link.id, body);
      toast(t('trialLinks.admin.saved'), 'success');
      onChanged();
    } catch {
      toast(t('trialLinks.admin.saveFailed'), 'error');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast(t('trialLinks.links.copied'), 'success');
    } catch { /* the address is on screen */ }
  };

  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm @2xl:grid-cols-[auto_1fr]">
      <QrImage url={link.url} code={link.code} title={link.title} />
      <div className="min-w-0 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{link.title}</h3>
            {link.closed_reason && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t(`trialLinks.links.reason.${link.closed_reason}`)}
              </span>
            )}
          </div>
          <button type="button" onClick={copy}
            className="mt-1 inline-flex max-w-full items-center gap-1.5 font-mono text-sm text-primary hover:underline">
            <span className="truncate">{displayUrl(link.url)}</span><Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        </div>
        <dl className="flex gap-6 text-sm">
          <div><dt className="text-xs text-muted-foreground">{t('trialLinks.admin.kpi.opens')}</dt><dd className="text-xl font-bold tabular-nums">{link.opens}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('trialLinks.admin.kpi.signups')}</dt><dd className="text-xl font-bold tabular-nums">{link.signups}</dd></div>
        </dl>
        <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={link.is_active} onCheckedChange={(v) => save({ is_active: v === true })} />
            {t('trialLinks.links.active')}
          </label>
          <div className="space-y-1">
            <Label htmlFor={`cap-${link.id}`} className="text-xs">{t('trialLinks.links.cap')} <span className="text-muted-foreground">({t('trialLinks.links.capHint')})</span></Label>
            <Input id={`cap-${link.id}`} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} className="w-28"
              onBlur={() => { if (cap !== (link.signup_cap?.toString() ?? '')) void save({ signup_cap: cap ? Number(cap) : null }); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`closes-${link.id}`} className="text-xs">{t('trialLinks.links.closesAt')}</Label>
            <Input id={`closes-${link.id}`} type="date" value={closes} className="w-40"
              onChange={(e) => setCloses(e.target.value)}
              onBlur={() => {
                if (closes === almatyDay(link.closes_at)) return;
                // The link closes at the END of the chosen Almaty day.
                void save({ closes_at: closes ? fromDatetimeLocalKZ(`${closes}T23:59`) : null });
              }} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function LinksTab({ links, onChanged }: { links: TrialLinkRow[]; onChanged: () => void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      await createTrialLink({ title: title.trim() });
      setTitle('');
      onChanged();
    } catch {
      toast(t('trialLinks.admin.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {links.map((l) => <LinkCard key={`${l.id}-${l.signup_cap}-${l.closes_at}`} link={l} onChanged={onChanged} />)}
      <section className="rounded-2xl border border-dashed border-border p-5">
        <h3 className="text-sm font-semibold text-foreground">{t('trialLinks.links.new')}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t('trialLinks.links.newHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('trialLinks.links.titleLabel')} className="w-72" maxLength={120} />
          <Button onClick={create} disabled={busy || title.trim().length < 2}><Plus className="mr-1.5 h-4 w-4" aria-hidden />{t('trialLinks.links.create')}</Button>
        </div>
      </section>
    </div>
  );
}
