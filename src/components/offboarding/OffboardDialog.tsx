import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import HandoverStep from './HandoverStep';
import DetailsStep from './DetailsStep';
import OpenRecordPanel from './OpenRecordPanel';
import { useAuth } from '../../contexts/AuthContext';
import {
  almatyToday,
  createRequest,
  dialogStage,
  formProblems,
  hasBlockers,
  mayUseEmergency,
  targetRef,
  type FormProblem,
  type OffboardForm,
} from '../../lib/offboarding';
import {
  OffboardingError,
  createOffboarding,
  previewOffboarding,
  type OffboardingConfig,
  type OffboardingRecord,
  type OffboardPreview,
  type TargetRef,
} from '../../services/api/offboarding';
import { formatDate } from '../../lib/i18n';
import { serverMessage } from '../../lib/i18n/serverError';
import { useLocale, useT } from '../../lib/i18n/react';
import type { Locale } from '../../lib/i18n/locale';
import '@/lib/i18n/catalogs/offboarding';

export interface OffboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: TargetRef;
  /** Shown until the preview names them. */
  name: string;
  config: OffboardingConfig;
  /** Called after a record was created, cancelled or confirmed, so the caller can refresh. */
  onChanged?: (record: OffboardingRecord) => void;
}

const EMPTY_FORM: OffboardForm = { mode: 'scheduled', lastDay: '', reason: '', note: '' };

/**
 * Offboard one person (SPEC §9): what they still own, with the reassign helper → last day or
 * immediately → reason and note → confirm. When they already have an open record, that record
 * with cancel / second-admin confirm instead. The server checks every rule again.
 */
export default function OffboardDialog({ open, onOpenChange, target, name, config, onChanged }: OffboardDialogProps) {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const viewerId = user?.id != null ? Number(user.id) : null;
  const [preview, setPreview] = useState<OffboardPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<OffboardForm>(EMPTY_FORM);
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<OffboardingRecord | null>(null);
  const today = almatyToday();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setPreview(await previewOffboarding(target));
    } catch (e) {
      setLoadError((e instanceof Error && e.message) || t('offboarding.dialog.loadFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target), t]);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setForm(EMPTY_FORM);
    setProblems([]);
    setSubmitError(null);
    setCreated(null);
    load();
  }, [open, load]);

  const allowEmergency = mayUseEmergency(user?.role, config.modes);
  // An emergency switch-off skips the hand-over: what they own stays assigned and is listed on the record.
  const previewStage = preview ? dialogStage(preview) : null;
  const stage = previewStage === 'handover' && form.mode === 'emergency' ? 'details' : previewStage;
  const shownName = preview?.target.name || name;

  const submit = async () => {
    if (!preview) return;
    const ref = targetRef(preview.target) ?? target;
    const found = formProblems(form, today);
    setProblems(found);
    if (found.length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const record = await createOffboarding(createRequest(ref, form, today));
      setCreated(record);
      onChanged?.(record);
    } catch (e) {
      if (e instanceof OffboardingError && e.blockers) {
        // Someone gave them a group meanwhile: back to the hand-over step with the fresh list.
        setSubmitError(t('offboarding.form.blockedAgain'));
        setPreview({ ...preview, blocked: true, blockers: e.blockers });
      } else if (e instanceof OffboardingError && e.code === 'offboarding_open_record') {
        // Another admin got there first: show their record.
        load();
      } else {
        setSubmitError((e instanceof Error && e.message) || t('offboarding.form.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const recordChanged = (record: OffboardingRecord) => {
    onChanged?.(record);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('offboarding.dialog.title', { name: shownName })}</DialogTitle>
          {preview && <DialogDescription>{preview.target.email ?? ''}</DialogDescription>}
        </DialogHeader>

        {!preview && !loadError && <p className="text-sm text-muted-foreground">{t('offboarding.dialog.loading', { name })}</p>}
        {loadError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>{t('offboarding.dialog.retry')}</Button>
          </div>
        )}

        {created ? (
          <CreatedResult record={created} />
        ) : preview && stage === 'not_allowed' ? (
          <p className="text-sm text-foreground">{whyNot(preview.why_not, locale) || t('offboarding.dialog.notAllowed')}</p>
        ) : preview && stage === 'open_record' && preview.open_record ? (
          <OpenRecordPanel record={preview.open_record} viewerId={viewerId} onChanged={recordChanged} />
        ) : preview && stage === 'handover' ? (
          <>
            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
            <HandoverStep preview={preview} onRecheck={load} />
            {allowEmergency && (
              <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                <p className="text-sm text-foreground">{t('offboarding.handover.emergencyIntro')}</p>
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, mode: 'emergency' })}>
                  {t('offboarding.handover.emergencyButton')}
                </Button>
              </div>
            )}
          </>
        ) : preview && stage === 'details' ? (
          <DetailsStep
            name={shownName}
            form={form}
            onChange={setForm}
            reasons={config.reasons}
            today={today}
            needsSecondAdmin={preview.needs_second_admin}
            // With nothing owned, an emergency is the same as «immediately».
            allowEmergency={allowEmergency && hasBlockers(preview.blockers)}
            satWarning={preview.blockers.sat_checked ? null : preview.blockers.sat_warning ?? ''}
            problems={problems}
            disabled={submitting}
          />
        ) : null}

        {stage === 'details' && !created && submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('offboarding.dialog.close')}</Button>
          {stage === 'details' && !created && (
            <Button variant="destructive" onClick={submit} disabled={submitting}>
              {submitting ? t('offboarding.form.submitting') : t('offboarding.form.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Why the viewer cannot offboard this person, in their language when the code is in the catalog. */
function whyNot(why: OffboardPreview['why_not'], locale: Locale): string {
  return why ? serverMessage(why.code, why.message, locale) : '';
}

function CreatedResult({ record }: { record: OffboardingRecord }) {
  const t = useT();
  const text = record.status === 'awaiting_confirmation'
    ? t('offboarding.result.awaiting')
    : record.status === 'completed'
      ? t('offboarding.result.completed')
      : t('offboarding.result.pending', { date: formatDate(record.last_day) });
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">{text}</p>
      <Button variant="outline" size="sm" asChild>
        <Link to={`/admin/offboarding/${record.id}`}>{t('offboarding.result.openRecord')}</Link>
      </Button>
    </div>
  );
}
