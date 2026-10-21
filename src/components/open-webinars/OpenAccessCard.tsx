import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Globe2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import WhoCanJoinSection from './WhoCanJoinSection';
import { accessBody, closeBlock, draftOf, isPublicMode, type AccessDraft } from './accessModel';
import {
  closeOpenAccess, getOpenAccess, getOpenSettings, listGuestSpeakers, saveOpenAccess,
  type GuestSpeaker, type OpenAccess, type OpenSettings,
} from '../../services/api/openWebinars';
import { reasonCodeOf } from '../../services/api/apiError';
import { LMS_ORIGIN } from '../../lib/lessonLinks';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

/** Refusals that mean the card was showing stale facts (someone registered, the webinar began): it reloads them. */
const STALE_FACTS = ['slug_locked', 'close_after_start', 'close_has_registrations'];
const AMBER = 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200';

interface Props {
  eventId: number;
  /** The form's Host differs from the saved one: the guard reads the saved one. */
  hostUnsaved?: boolean;
  /** Why saving the public access failed right after the event was created (the create form hands it over). */
  initialError?: string | null;
}

/**
 * «Public access» of one webinar, on its edit page: students only (as always), anyone with the link, or anyone
 * who registers. Saved on its own — it is not part of the event form's Save, because it is not a field of the event.
 */
export default function OpenAccessCard({ eventId, hostUnsaved = false, initialError = null }: Props) {
  const t = useT();
  const [access, setAccess] = useState<OpenAccess | null>(null);
  const [settings, setSettings] = useState<OpenSettings | null>(null);
  const [speakers, setSpeakers] = useState<GuestSpeaker[]>([]);
  const [draft, setDraft] = useState<AccessDraft | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    initialError ? { kind: 'error', text: t('openWebinars.admin.access.afterCreateFailed', { message: initialError }) } : null,
  );
  const [copied, setCopied] = useState(false);

  const apply = useCallback((a: OpenAccess) => { setAccess(a); setDraft(draftOf(a)); }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const a = await getOpenAccess(eventId);
        // The webinar's own speaker stays in the list even after they were removed from it.
        const [s, sp] = await Promise.all([getOpenSettings(), listGuestSpeakers(a.speaker_id)]);
        if (!live) return;
        setSettings(s); setSpeakers(sp); apply(a); setState('ready');
      } catch {
        if (live) setState('failed');
      }
    })();
    return () => { live = false; };
  }, [eventId, apply]);

  if (state === 'loading') return <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</CardContent></Card>;
  if (state === 'failed' || !access || !settings || !draft) return <Card><CardContent className="py-6 text-sm text-muted-foreground">{t('openWebinars.admin.loadFailed')}</CardContent></Card>;

  const title = <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" aria-hidden />{t('openWebinars.admin.access.title')}</CardTitle>;
  // A series cannot be opened (the server refuses it); each occurrence is opened from its own edit page.
  if (access.is_recurring && !access.open) {
    return <Card><CardHeader>{title}</CardHeader><CardContent><p data-recurring-note className="text-sm text-muted-foreground">{t('openWebinars.admin.access.recurringNote')}</p></CardContent></Card>;
  }

  const policyMissing = draft.mode === 'registration' && !settings.policy_text.trim();
  // The same rule the server applies: a Meet link on the event, or a saved host with a Workspace account.
  const roomPossible = access.has_meeting_url || access.host?.has_workspace === true;
  const hostNote = access.has_meeting_url ? 'link' : !access.host ? 'none' : access.host.has_workspace ? 'ok' : 'noWorkspace';
  const hostBlocked = draft.mode !== 'students' && (hostUnsaved || !roomPossible);
  const publicUrl = access.slug ? `${LMS_ORIGIN}/w/${access.slug}` : null;
  const blocked = closeBlock(access);
  const slugLocked = access.slug_locked === true;

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (!isPublicMode(draft)) {
        if (access.open) await closeOpenAccess(eventId);
        setNote({ kind: 'ok', text: t('openWebinars.admin.access.closed') });
      } else {
        await saveOpenAccess(eventId, accessBody({ ...draft, pipelineId: draft.pipelineId as number }, slugLocked));
        setNote({ kind: 'ok', text: t('openWebinars.admin.saved') });
      }
      apply(await getOpenAccess(eventId));
    } catch (failure) {
      setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('openWebinars.error.generic') });
      const code = reasonCodeOf(failure);
      if (code && STALE_FACTS.includes(code)) {
        try { apply(await getOpenAccess(eventId)); } catch { /* the refusal above is already on screen */ }
      }
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
        {title}
        <p className="text-sm text-muted-foreground">{t('openWebinars.admin.access.help')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <WhoCanJoinSection
          draft={draft}
          onChange={setDraft}
          pipelines={settings.pipelines}
          speakers={speakers}
          addressPreview={access.slug}
          slugLocked={slugLocked}
          studentsDisabledReason={blocked ? t(`openWebinars.admin.access.closeBlocked.${blocked}` as 'openWebinars.admin.access.closeBlocked.started') : null}
        >
          <p data-host-note={hostUnsaved ? 'unsaved' : hostNote} role={hostBlocked ? 'alert' : 'status'}
             className={hostBlocked ? AMBER : 'rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground'}>
            {hostUnsaved
              ? t('openWebinars.admin.access.host.unsaved')
              : t(`openWebinars.admin.access.host.${hostNote}` as 'openWebinars.admin.access.host.ok', { name: access.host?.name ?? '' })}
            {!hostUnsaved && hostNote === 'noWorkspace' && (<>{' '}<Link to="/admin/users" className="underline underline-offset-4">{t('openWebinars.admin.access.host.manageUsers')}</Link></>)}
          </p>
          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{t('openWebinars.admin.access.producer')}</p>
          {policyMissing && (
            <p role="alert" className={AMBER}>
              {t('openWebinars.admin.access.needPolicy')}{' '}
              <Link to="/admin/open-webinars" className="underline underline-offset-4">{t('openWebinars.admin.access.policyLink')}</Link>
            </p>
          )}
        </WhoCanJoinSection>

        {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-green-700 dark:text-green-400'}>{note.text}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={busy || policyMissing || hostBlocked || (draft.mode !== 'students' && draft.pipelineId === null)}>
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
