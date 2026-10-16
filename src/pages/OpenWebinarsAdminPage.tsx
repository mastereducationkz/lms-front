import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  createGuestSpeaker, getOpenSettings, listGuestSpeakers, retireGuestSpeaker, saveOpenSettings, updateGuestSpeaker,
  type GuestSpeaker, type OpenSettings, type SpeakerInput,
} from '../services/api/openWebinars';
import { formatDate } from '../lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

const EMPTY: SpeakerInput = { name: '', organisation: '', bio: '', photo_url: '', email: '' };
const blankToNull = (s: SpeakerInput): SpeakerInput => ({
  name: s.name.trim(), organisation: s.organisation?.trim() || null, bio: s.bio?.trim() || null, photo_url: s.photo_url?.trim() || null, email: s.email?.trim() || null,
});

/** Admin → Open webinars: the privacy policy and consent wording every public form uses, and the guest speakers. */
export default function OpenWebinarsAdminPage() {
  const t = useT();
  const locale = useLocale();
  const [settings, setSettings] = useState<OpenSettings | null>(null);
  const [policy, setPolicy] = useState('');
  const [consentRu, setConsentRu] = useState('');
  const [consentEn, setConsentEn] = useState('');
  const [speakers, setSpeakers] = useState<GuestSpeaker[]>([]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<SpeakerInput>(EMPTY);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const show = (s: OpenSettings) => { setSettings(s); setPolicy(s.policy_text); setConsentRu(s.consent_text_ru); setConsentEn(s.consent_text_en); };
  useEffect(() => {
    let live = true;
    Promise.all([getOpenSettings(), listGuestSpeakers()])
      .then(([s, sp]) => { if (live) { show(s); setSpeakers(sp); } })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  const fail = (failure: unknown) => setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('openWebinars.error.generic') });

  const saveSettings = async () => {
    setBusy(true); setNote(null);
    try { show(await saveOpenSettings({ policy_text: policy, consent_text_ru: consentRu, consent_text_en: consentEn })); setNote({ kind: 'ok', text: t('openWebinars.admin.saved') }); }
    catch (failure) { fail(failure); } finally { setBusy(false); }
  };

  const saveSpeaker = async () => {
    setBusy(true); setNote(null);
    try {
      const body = blankToNull(draft);
      const saved = editing === 'new' ? await createGuestSpeaker(body) : await updateGuestSpeaker(editing as number, body);
      setSpeakers((all) => (editing === 'new' ? [...all, saved] : all.map((s) => (s.id === saved.id ? saved : s))).sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(null); setDraft(EMPTY);
    } catch (failure) { fail(failure); } finally { setBusy(false); }
  };

  const retire = async (id: number) => {
    try { await retireGuestSpeaker(id); setSpeakers((all) => all.filter((s) => s.id !== id)); } catch (failure) { fail(failure); }
  };

  if (failed) return <p className="p-6 text-sm text-muted-foreground">{t('openWebinars.admin.loadFailed')}</p>;
  if (!settings) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('openWebinars.admin.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('openWebinars.admin.intro')}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('openWebinars.admin.policy.title')}</CardTitle><p className="text-sm text-muted-foreground">{t('openWebinars.admin.policy.help')}</p></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {settings.policy_version
              ? `${t('openWebinars.admin.policy.version', { version: settings.policy_version })}${settings.policy_updated_at ? ` · ${formatDate(settings.policy_updated_at, undefined, locale)}` : ''}`
              : t('openWebinars.admin.policy.none')}
          </p>
          <Textarea aria-label={t('openWebinars.admin.policy.title')} value={policy} onChange={(e) => setPolicy(e.target.value)} rows={14} />
          <div className="space-y-1.5"><Label htmlFor="ow-consent-ru">{t('openWebinars.admin.consent.ru')}</Label><Textarea id="ow-consent-ru" value={consentRu} onChange={(e) => setConsentRu(e.target.value)} rows={3} /></div>
          <div className="space-y-1.5"><Label htmlFor="ow-consent-en">{t('openWebinars.admin.consent.en')}</Label><Textarea id="ow-consent-en" value={consentEn} onChange={(e) => setConsentEn(e.target.value)} rows={3} /></div>
          <Button type="button" onClick={saveSettings} disabled={busy}>{busy ? t('openWebinars.admin.saving') : t('openWebinars.admin.save')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('openWebinars.admin.speakers.title')}</CardTitle><p className="text-sm text-muted-foreground">{t('openWebinars.admin.speakers.help')}</p></CardHeader>
        <CardContent className="space-y-4">
          {speakers.length === 0 && editing === null && <p className="text-sm text-muted-foreground">{t('openWebinars.admin.speakers.empty')}</p>}
          <ul className="divide-y divide-border">
            {speakers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><span className="font-medium">{s.name}</span>{s.organisation && <span className="text-muted-foreground">, {s.organisation}</span>}</span>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(s.id); setDraft({ name: s.name, organisation: s.organisation ?? '', bio: s.bio ?? '', photo_url: s.photo_url ?? '', email: s.email ?? '' }); }}>{t('openWebinars.admin.speakers.edit')}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => retire(s.id)}>{t('openWebinars.admin.speakers.remove')}</Button>
                </span>
              </li>
            ))}
          </ul>
          {editing === null ? (
            <Button type="button" variant="outline" onClick={() => { setEditing('new'); setDraft(EMPTY); }}>{t('openWebinars.admin.speakers.add')}</Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              {(['name', 'organisation', 'photo_url', 'email'] as const).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`ow-sp-${field}`}>{t(`openWebinars.admin.speakers.${field === 'photo_url' ? 'photo' : field}` as 'openWebinars.admin.speakers.name')}</Label>
                  <Input id={`ow-sp-${field}`} value={draft[field] ?? ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5"><Label htmlFor="ow-sp-bio">{t('openWebinars.admin.speakers.bio')}</Label><Textarea id="ow-sp-bio" value={draft.bio ?? ''} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} rows={3} /></div>
              <div className="flex gap-2">
                <Button type="button" onClick={saveSpeaker} disabled={busy || draft.name.trim().length < 2}>{busy ? t('openWebinars.admin.saving') : t('openWebinars.admin.save')}</Button>
                <Button type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(EMPTY); }}>{t('openWebinars.admin.speakers.cancel')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-green-700 dark:text-green-400'}>{note.text}</p>}
    </div>
  );
}
