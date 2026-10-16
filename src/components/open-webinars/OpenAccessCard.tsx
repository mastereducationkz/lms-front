import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Globe2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  closeOpenAccess, getOpenAccess, getOpenSettings, listGuestSpeakers, saveOpenAccess,
  type AccessMode, type GuestSpeaker, type OpenAccess, type OpenSettings,
} from '../../services/api/openWebinars';
import { LMS_ORIGIN } from '../../lib/lessonLinks';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

const MODES: AccessMode[] = ['students', 'open', 'registration'];
const FIELD = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

/**
 * «Public access» of one webinar, on its edit page: students only (as always), anyone with the link, or anyone
 * who registers. Saved on its own — it is not part of the event form's Save, because it is not a field of the event.
 */
export default function OpenAccessCard({ eventId }: { eventId: number }) {
  const t = useT();
  const [access, setAccess] = useState<OpenAccess | null>(null);
  const [settings, setSettings] = useState<OpenSettings | null>(null);
  const [speakers, setSpeakers] = useState<GuestSpeaker[]>([]);
  const [mode, setMode] = useState<AccessMode>('students');
  const [slug, setSlug] = useState('');
  const [speakerId, setSpeakerId] = useState<number | null>(null);
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const apply = useCallback((a: OpenAccess, s: OpenSettings) => {
    setAccess(a);
    setMode(a.access_mode);
    setSlug(a.slug ?? '');
    setSpeakerId(a.speaker_id);
    setPipelineId(a.lead_pipeline_id ?? s.pipelines[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([getOpenAccess(eventId), getOpenSettings(), listGuestSpeakers()])
      .then(([a, s, sp]) => { if (!live) return; setSettings(s); setSpeakers(sp); apply(a, s); setState('ready'); })
      .catch(() => live && setState('failed'));
    return () => { live = false; };
  }, [eventId, apply]);

  if (state === 'loading') return <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</CardContent></Card>;
  if (state === 'failed' || !access || !settings) return <Card><CardContent className="py-6 text-sm text-muted-foreground">{t('openWebinars.admin.loadFailed')}</CardContent></Card>;

  const policyMissing = mode === 'registration' && !settings.policy_text.trim();
  const publicUrl = access.slug ? `${LMS_ORIGIN}/w/${access.slug}` : null;

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (mode === 'students') {
        if (access.open) await closeOpenAccess(eventId);
        setNote({ kind: 'ok', text: t('openWebinars.admin.access.closed') });
      } else {
        await saveOpenAccess(eventId, { access_mode: mode, slug: slug.trim() || null, speaker_id: speakerId, lead_pipeline_id: pipelineId ?? 0 });
        setNote({ kind: 'ok', text: t('openWebinars.admin.saved') });
      }
      apply(await getOpenAccess(eventId), settings);
    } catch (failure) {
      setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('openWebinars.error.generic') });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the link is shown anyway */ }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" aria-hidden />{t('openWebinars.admin.access.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('openWebinars.admin.access.help')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('openWebinars.admin.access.mode')}</legend>
          {MODES.map((id) => (
            <label key={id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="access-mode" value={id} checked={mode === id} onChange={() => setMode(id)} className="mt-1" />
              <span>
                <span className="font-medium">{t(`openWebinars.admin.access.${id}` as 'openWebinars.admin.access.students')}</span>
                {id !== 'students' && <span className="block text-xs text-muted-foreground">{t(id === 'open' ? 'openWebinars.admin.access.openHint' : 'openWebinars.admin.access.registrationHint')}</span>}
              </span>
            </label>
          ))}
        </fieldset>

        {mode !== 'students' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ow-slug">{t('openWebinars.admin.access.slug')}</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground"><span className="shrink-0">{LMS_ORIGIN.replace(/^https?:\/\//, '')}/w/</span>
                <Input id="ow-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder={t('openWebinars.admin.access.slugExample')} /></div>
              <p className="text-xs text-muted-foreground">{t('openWebinars.admin.access.slugHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ow-speaker">{t('openWebinars.admin.access.speaker')}</Label>
              <select id="ow-speaker" className={FIELD} value={speakerId ?? ''} onChange={(e) => setSpeakerId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t('openWebinars.admin.access.noSpeaker')}</option>
                {speakers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.organisation ? `, ${s.organisation}` : ''}</option>)}
              </select>
              <Link to="/admin/open-webinars" className="text-xs text-primary underline-offset-4 hover:underline">{t('openWebinars.admin.access.manageSpeakers')}</Link>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ow-pipeline">{t('openWebinars.admin.access.pipeline')}</Label>
              <select id="ow-pipeline" className={FIELD} value={pipelineId ?? ''} onChange={(e) => setPipelineId(Number(e.target.value))}>
                {settings.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{t('openWebinars.admin.access.producer')}</p>
            {policyMissing && (
              <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                {t('openWebinars.admin.access.needPolicy')}{' '}
                <Link to="/admin/open-webinars" className="underline underline-offset-4">{t('openWebinars.admin.access.policyLink')}</Link>
              </p>
            )}
          </div>
        )}

        {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-green-700 dark:text-green-400'}>{note.text}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={busy || policyMissing || (mode !== 'students' && pipelineId === null)}>
            {busy ? t('openWebinars.admin.saving') : t('openWebinars.admin.save')}
          </Button>
          {access.open && publicUrl && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t('openWebinars.admin.access.publicLink')}>
                {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
                {copied ? t('openWebinars.admin.access.copied') : t('openWebinars.admin.access.copy')}
              </Button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-primary underline-offset-4 hover:underline">{publicUrl}</a>
            </>
          )}
        </div>
        {access.open && (
          <p className="text-sm text-muted-foreground">
            {t('openWebinars.admin.access.summary', { registered: access.funnel.registered, joined: access.funnel.joined })}{' · '}
            <Link to={`/admin/open-webinars/${eventId}`} className="text-primary underline-offset-4 hover:underline">{t('openWebinars.admin.access.registrations')}</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
