import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, QrCode, Square } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NativeSelect } from '../../ui/native-select';
import { toast } from '../../Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useLocale, useT } from '../../../lib/i18n/react';
import { formatDateTime, formatTime } from '../../../lib/i18n/format';
import {
  getPresentationLive, listPresentations, listStaffSchools, startPresentation, stopPresentation,
  type Presentation, type StaffSchool, type TrialLinkRow,
} from '../../../services/api/trialLinks';
import { QrFullscreen } from '../QrImage';
import '@/lib/i18n/catalogs/trialLinks';

/** The live counter re-reads this often: a class signs up within a couple of minutes. */
const LIVE_MS = 5_000;

function Running({ p, link, onStopped }: { p: Presentation; link?: TrialLinkRow; onStopped: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [live, setLive] = useState(p);
  const [qr, setQr] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      getPresentationLive(p.id).then((next) => { setLive(next); if (!next.running) onStopped(); }).catch(() => undefined);
    }, LIVE_MS);
    return () => window.clearInterval(id);
  }, [p.id, onStopped]);

  const stop = async () => {
    setStopping(true);
    try { await stopPresentation(p.id); onStopped(); } catch { toast(t('trialLinks.admin.saveFailed'), 'error'); } finally { setStopping(false); }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
        {t('trialLinks.present.running')}
      </p>
      <h2 className="mt-2 text-xl font-bold text-foreground">{live.school}</h2>
      <div className="mt-5 flex items-end gap-3">
        <span className="text-7xl font-black tabular-nums leading-none text-foreground">{live.signups}</span>
        <span className="pb-2 text-base text-muted-foreground">{t('trialLinks.present.signedUp', { count: live.signups })}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t('trialLinks.present.endsAt', { time: formatTime(live.ends_at, undefined, locale) })}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {link && (
          <Button size="lg" onClick={() => setQr(true)}><QrCode className="mr-2 h-4 w-4" aria-hidden />{t('trialLinks.present.showQr')}</Button>
        )}
        <Button size="lg" variant="outline" onClick={stop} disabled={stopping}>
          {stopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Square className="mr-2 h-4 w-4" aria-hidden />}
          {t('trialLinks.present.stop')}
        </Button>
      </div>
      {link && <QrFullscreen url={link.url} open={qr} onOpenChange={setQr} title={link.title} />}
    </section>
  );
}

export default function PresentTab({ links }: { links: TrialLinkRow[] }) {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const [recent, setRecent] = useState<Presentation[]>([]);
  const [schools, setSchools] = useState<StaffSchool[]>([]);
  const [linkId, setLinkId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => { listPresentations().then(setRecent).catch(() => undefined); }, []);
  useEffect(() => { reload(); listStaffSchools().then((s) => setSchools(s.filter((x) => x.confirmed))).catch(() => undefined); }, [reload]);
  useEffect(() => { if (!linkId && links.length) setLinkId(String(links[0].id)); }, [links, linkId]);

  const mine = useMemo(() => recent.find((p) => p.running && user != null && String(p.presenter_id) === String(user.id)), [recent, user?.id]);
  const others = recent.filter((p) => p !== mine);
  const linkOf = (id: number) => links.find((l) => l.id === id);

  const start = async () => {
    const newSchool = newName.trim().length >= 2 ? { name: newName.trim(), city: newCity.trim() } : undefined;
    if (!linkId || (!schoolId && !newSchool)) { toast(t('trialLinks.present.chooseSchool'), 'error'); return; }
    setBusy(true);
    try {
      await startPresentation({ link_id: Number(linkId), ...(newSchool ? { new_school: newSchool } : { school_id: Number(schoolId) }) });
      setNewName(''); setNewCity(''); setSchoolId('');
      reload();
    } catch {
      toast(t('trialLinks.admin.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 @4xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        {mine ? <Running p={mine} link={linkOf(mine.link_id)} onStopped={reload} /> : (
          <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('trialLinks.present.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('trialLinks.present.help')}</p>
            </div>
            {links.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">{t('trialLinks.present.link')}</Label>
                <NativeSelect value={linkId} onValueChange={setLinkId}>
                  {links.map((l) => <option key={l.id} value={String(l.id)}>{l.title}</option>)}
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{t('trialLinks.present.school')}</Label>
              <NativeSelect value={schoolId} onValueChange={(v) => { setSchoolId(v); setNewName(''); }} searchable
                placeholder={t('trialLinks.present.schoolSearch')} searchPlaceholder={t('trialLinks.present.schoolSearch')}>
                <option value="">—</option>
                {schools.map((s) => <option key={s.id} value={String(s.id)}>{s.city ? `${s.name}, ${s.city}` : s.name}</option>)}
              </NativeSelect>
            </div>
            <fieldset className="space-y-2 rounded-xl bg-muted/50 p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">{t('trialLinks.present.newSchool')}</legend>
              <div className="grid gap-2 @lg:grid-cols-[2fr_1fr]">
                <Input value={newName} onChange={(e) => { setNewName(e.target.value); setSchoolId(''); }} placeholder={t('trialLinks.present.newSchoolName')} maxLength={160} />
                <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder={t('trialLinks.present.newSchoolCity')} maxLength={80} />
              </div>
            </fieldset>
            <Button size="lg" className="w-full" onClick={start} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Play className="mr-2 h-4 w-4" aria-hidden />}
              {t('trialLinks.present.start')}
            </Button>
          </section>
        )}
      </div>
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{t('trialLinks.present.recent')}</h3>
        {others.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">{t('trialLinks.admin.empty')}</p> : (
          <ul className="divide-y divide-border">
            {others.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.school ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.started_at, undefined, locale)}{p.presenter ? ` · ${t('trialLinks.present.by', { name: p.presenter })}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.running && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
                  <span className="text-lg font-bold tabular-nums">{p.signups}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
