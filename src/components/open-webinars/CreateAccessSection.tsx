import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import WhoCanJoinSection from './WhoCanJoinSection';
import { preflightBodyOf, presenterOf, speakerMissing, type AccessDraft, type EventFacts } from './accessModel';
import { usePreflightPreview } from './usePreflightPreview';
import { getOpenSettings, listGuestSpeakers, type GuestSpeaker, type OpenSettings } from '../../services/api/openWebinars';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

interface Props {
  draft: AccessDraft;
  onChange: (next: AccessDraft) => void;
  /** The event's own fields as the form holds them now: what the server's check and the summary read. */
  facts: EventFacts;
  /** The chosen host's name in the LMS (what «The host» would show), or undefined while none is chosen. */
  hostName?: string;
}

const NOTE = 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200';

/**
 * «Who can join» on the create form of a webinar, for the roles that may open one to everyone. While the
 * fields are filled in it asks the server what Save would do (the address it would use, or why not), so the
 * summary names the real address and a refusal shows here, before anything is created.
 */
export default function CreateAccessSection({ draft, onChange, facts, hostName }: Props) {
  const t = useT();
  const [options, setOptions] = useState<{ settings: OpenSettings; speakers: GuestSpeaker[] } | 'failed' | null>(null);
  const preview = usePreflightPreview(preflightBodyOf(draft, facts));

  useEffect(() => {
    let live = true;
    Promise.all([getOpenSettings(), listGuestSpeakers()])
      .then(([settings, speakers]) => live && setOptions({ settings, speakers }))
      .catch(() => live && setOptions('failed'));
    return () => { live = false; };
  }, []);

  const loaded = options && options !== 'failed' ? options : null;
  const policyMissing = draft.mode === 'registration' && !!loaded && !loaded.settings.policy_text.trim();
  const pipeline = loaded?.settings.pipelines.find((p) => p.id === draft.pipelineId);
  const address = draft.slug.trim() || preview.slug;
  const speaker = loaded?.speakers.find((sp) => sp.id === draft.speakerId);
  // Who the public page will name, in the summary: the guest speaker, the host (by name), or nobody.
  const chosen = presenterOf(draft);
  const presenterText = chosen === 'speaker'
    ? t('openWebinars.admin.access.presenter.summary.speaker', { name: speaker?.name ?? '' })
    : chosen === 'none'
      ? t('openWebinars.admin.access.presenter.summary.none')
      : hostName ? t('openWebinars.admin.access.presenter.summary.hostNamed', { name: hostName }) : t('openWebinars.admin.access.presenter.summary.host');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" aria-hidden />{t('openWebinars.admin.access.mode')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {facts.isRecurring ? (
          <p data-recurring-note className="text-sm text-muted-foreground">{t('openWebinars.admin.access.recurringNote')}</p>
        ) : options === 'failed' ? (
          <p role="alert" className="text-sm text-muted-foreground">{t('openWebinars.admin.loadFailed')}</p>
        ) : (
          <WhoCanJoinSection
            hideLegend
            showNoAudience
            draft={draft}
            onChange={onChange}
            pipelines={loaded?.settings.pipelines ?? []}
            speakers={loaded?.speakers ?? []}
            hostName={hostName}
            addressPreview={preview.slug}
          >
            {policyMissing && (
              <p role="alert" className={NOTE}>
                {t('openWebinars.admin.access.needPolicy')}{' '}
                <Link to="/admin/open-webinars" className="underline underline-offset-4">{t('openWebinars.admin.access.policyLink')}</Link>
              </p>
            )}
            {preview.error && <p role="alert" data-preflight-error className="text-sm text-red-600 dark:text-red-400">{preview.error}</p>}
            {pipeline && !preview.error && !speakerMissing(draft) && (
              <p role="status" data-summary className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                {t('openWebinars.admin.access.create.summary', {
                  address: address ? `/w/${address}` : t('openWebinars.admin.access.create.addressPending'),
                  presenter: presenterText,
                  pipeline: pipeline.name,
                })}
                {preview.checking && ` · ${t('openWebinars.admin.access.create.checking')}`}
              </p>
            )}
          </WhoCanJoinSection>
        )}
      </CardContent>
    </Card>
  );
}
