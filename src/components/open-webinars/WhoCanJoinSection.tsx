import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import BannerField from './BannerField';
import { presenterOf, type AccessDraft } from './accessModel';
import type { AccessMode, GuestSpeaker, Pipeline, Presenter } from '../../services/api/openWebinars';
import { LMS_ORIGIN } from '../../lib/lessonLinks';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

const MODES: AccessMode[] = ['students', 'open', 'registration'];
const PRESENTERS: Presenter[] = ['speaker', 'host', 'none'];
const FIELD = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const HOST = LMS_ORIGIN.replace(/^https?:\/\//, '');

interface Props {
  draft: AccessDraft;
  onChange: (next: AccessDraft) => void;
  pipelines: Pipeline[];
  speakers: GuestSpeaker[];
  /** The event's host as the LMS names them: what «The host» shows on the public page. Absent while none is chosen. */
  hostName?: string;
  /** The address that will be used when the draft has none of its own: the server's answer to the preflight. */
  addressPreview?: string | null;
  /** People have registered: the address is shown, not editable. */
  slugLocked?: boolean;
  /** Why «Students only» cannot be chosen (public access can no longer be closed); null when it can. */
  studentsDisabledReason?: string | null;
  /** Create form only: «No student audience» lifts the group/course requirement. */
  showNoAudience?: boolean;
  /** The heading is the card's title, so the radios' own legend is kept for screen readers only. */
  hideLegend?: boolean;
  disabled?: boolean;
  /** Notes after the fields: the host's Meet-room state, the privacy policy. */
  children?: ReactNode;
}

/**
 * The «Who can join» fields of a webinar, controlled by the caller: the mode, and for a public one the page
 * address, guest speaker, lead pipeline (never preselected), banner and — when creating — «No student
 * audience». Shared by the create form and the edit page's Public access card, so both say the same things.
 */
export default function WhoCanJoinSection({
  draft, onChange, pipelines, speakers, hostName, addressPreview = null, slugLocked = false, studentsDisabledReason = null,
  showNoAudience = false, hideLegend = false, disabled = false, children,
}: Props) {
  const t = useT();
  const [editingSlug, setEditingSlug] = useState(false);
  const set = (patch: Partial<AccessDraft>) => onChange({ ...draft, ...patch });
  const address = draft.slug.trim() || addressPreview || '';

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className={hideLegend ? 'sr-only' : 'mb-1 text-sm font-medium'}>{t('openWebinars.admin.access.mode')}</legend>
        {MODES.map((id) => {
          const blocked = id === 'students' && !!studentsDisabledReason;
          return (
            <label key={id} className={`flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${blocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input type="radio" name="access-mode" value={id} checked={draft.mode === id} disabled={blocked} onChange={() => set({ mode: id })} className="mt-1" />
              <span>
                <span className="font-medium">{t(`openWebinars.admin.access.${id}` as 'openWebinars.admin.access.students')}</span>
                {id !== 'students' && <span className="block text-xs text-muted-foreground">{t(id === 'open' ? 'openWebinars.admin.access.openHint' : 'openWebinars.admin.access.registrationHint')}</span>}
                {blocked && <span data-students-blocked className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300">{studentsDisabledReason}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      {draft.mode === 'registration' && (
        <div data-ask-profile className="flex items-start gap-2.5">
          <Checkbox id="ow-ask-profile" checked={draft.askProfile} disabled={disabled} onCheckedChange={(next) => set({ askProfile: next === true })} className="mt-0.5" />
          <Label htmlFor="ow-ask-profile" className="font-normal leading-snug">
            {t('openWebinars.admin.access.askProfile')}
            <span className="block text-xs text-muted-foreground">{t('openWebinars.admin.access.askProfileHint')}</span>
          </Label>
        </div>
      )}

      {draft.mode !== 'students' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={editingSlug && !slugLocked ? 'ow-slug' : undefined}>{t('openWebinars.admin.access.slug')}</Label>
            {slugLocked ? (
              <>
                <p data-address className="break-all text-sm">{HOST}/w/{draft.slug}</p>
                <p className="text-xs text-muted-foreground">{t('openWebinars.admin.access.slugLocked')}</p>
              </>
            ) : editingSlug ? (
              <>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="shrink-0">{HOST}/w/</span>
                  <Input id="ow-slug" value={draft.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} placeholder={addressPreview || t('openWebinars.admin.access.slugExample')} disabled={disabled} />
                </div>
                <p className="text-xs text-muted-foreground">{t('openWebinars.admin.access.slugHint')}</p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span data-address className="break-all">{address ? `${HOST}/w/${address}` : t('openWebinars.admin.access.slugAuto')}</span>
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setEditingSlug(true)}>{t('openWebinars.admin.access.editSlug')}</Button>
              </div>
            )}
          </div>

          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-1 text-sm font-medium">{t('openWebinars.admin.access.presenter.title')}</legend>
            {PRESENTERS.map((id) => (
              <label key={id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" name="presenter" value={id} checked={presenterOf(draft) === id} onChange={() => set({ presenter: id })} className="mt-1" />
                <span>
                  <span className="font-medium">{t(`openWebinars.admin.access.presenter.${id}` as 'openWebinars.admin.access.presenter.speaker')}</span>
                  <span data-presenter-hint={id} className="block text-xs text-muted-foreground">
                    {id === 'host'
                      ? (hostName ? t('openWebinars.admin.access.presenter.hostHintNamed', { name: hostName }) : t('openWebinars.admin.access.presenter.hostHint'))
                      : t(`openWebinars.admin.access.presenter.${id}Hint` as 'openWebinars.admin.access.presenter.speakerHint')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {presenterOf(draft) === 'speaker' && (
            <div className="space-y-1.5">
              <Label htmlFor="ow-speaker">{t('openWebinars.admin.access.speaker')}</Label>
              <select id="ow-speaker" className={FIELD} disabled={disabled} value={draft.speakerId ?? ''} onChange={(e) => set({ speakerId: e.target.value ? Number(e.target.value) : null })}>
                <option value="" disabled>{t('openWebinars.admin.access.presenter.speakerPlaceholder')}</option>
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.organisation ? `, ${s.organisation}` : ''}{s.is_active === false ? ` (${t('openWebinars.admin.access.speakerRemoved')})` : ''}
                  </option>
                ))}
              </select>
              {draft.speakerId === null && <p role="alert" data-speaker-required className="text-xs text-amber-800 dark:text-amber-300">{t('openWebinars.admin.access.presenter.speakerRequired')}</p>}
              <Link to="/admin/open-webinars" className="text-xs text-primary underline-offset-4 hover:underline">{t('openWebinars.admin.access.manageSpeakers')}</Link>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ow-pipeline">{t('openWebinars.admin.access.pipeline')}</Label>
            <select id="ow-pipeline" className={FIELD} disabled={disabled} value={draft.pipelineId ?? ''} onChange={(e) => set({ pipelineId: e.target.value ? Number(e.target.value) : null })}>
              <option value="" disabled>{t('openWebinars.admin.access.pipelinePlaceholder')}</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <BannerField value={draft.bannerUrl} onChange={(bannerUrl) => set({ bannerUrl })} disabled={disabled} />

          <fieldset data-english-version className="space-y-3 rounded-lg border border-border p-3" disabled={disabled}>
            <legend className="px-1 text-sm font-medium">{t('openWebinars.admin.access.english.title')}</legend>
            <p className="text-xs text-muted-foreground">{t('openWebinars.admin.access.english.hint')}</p>
            <div className="space-y-1.5">
              <Label htmlFor="ow-title-en">{t('openWebinars.admin.access.english.titleLabel')}</Label>
              <Input id="ow-title-en" value={draft.titleEn} onChange={(e) => set({ titleEn: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ow-description-en">{t('openWebinars.admin.access.english.descriptionLabel')}</Label>
              <Textarea id="ow-description-en" value={draft.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} rows={5} />
            </div>
          </fieldset>

          {showNoAudience && (
            <div className="flex items-start gap-2.5">
              <Checkbox id="ow-no-audience" checked={draft.noAudience} onCheckedChange={(next) => set({ noAudience: next === true })} className="mt-0.5" />
              <Label htmlFor="ow-no-audience" className="font-normal leading-snug">
                {t('openWebinars.admin.access.noAudience')}
                <span className="block text-xs text-muted-foreground">{t('openWebinars.admin.access.noAudienceHint')}</span>
              </Label>
            </div>
          )}

          {children}
        </div>
      )}
    </div>
  );
}
