import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  approveTestimonial,
  listTestimonials,
  revokeTestimonial,
  openTestimonialPhoto,
  upsertTestimonial,
  uploadTestimonialPhoto,
  type Testimonial,
} from '../../services/api/exams';
import { formatDate, type MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';
import '@/lib/i18n/catalogs/teacherInsights';

/**
 * Collect a student's photo and отзыв for the sales team, with the consent record.
 *
 * Consent is the point of this dialog, not an afterthought. The subjects are frequently
 * minors and the material is used in advertising, so saving requires stating which
 * channels the student agreed to and confirming the permission was actually obtained.
 * Approval is refused server-side without that record, and revocation is always
 * available because consent that cannot be withdrawn is not consent.
 */

const CHANNELS: { value: string; label: MessageKey; hint: MessageKey }[] = [
  { value: 'website', label: 'teacherInsights.testimonial.channel.website', hint: 'teacherInsights.testimonial.channel.websiteHint' },
  { value: 'social', label: 'teacherInsights.testimonial.channel.social', hint: 'teacherInsights.testimonial.channel.socialHint' },
  { value: 'ads', label: 'teacherInsights.testimonial.channel.ads', hint: 'teacherInsights.testimonial.channel.adsHint' },
  { value: 'print', label: 'teacherInsights.testimonial.channel.print', hint: 'teacherInsights.testimonial.channel.printHint' },
  { value: 'internal', label: 'teacherInsights.testimonial.channel.internal', hint: 'teacherInsights.testimonial.channel.internalHint' },
];

const STATUS_LABEL: Record<string, MessageKey> = {
  draft: 'teacherInsights.testimonial.status.draft',
  pending: 'teacherInsights.testimonial.status.pending',
  approved: 'teacherInsights.testimonial.status.approved',
  rejected: 'teacherInsights.testimonial.status.rejected',
  revoked: 'teacherInsights.testimonial.status.revoked',
};

interface Props {
  studentId: number;
  studentName: string;
  examResultId?: number | null;
  canApprove: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TestimonialDialog({
  studentId, studentName, examResultId, canApprove, onClose, onSaved,
}: Props) {
  const t = useT();
  const [existing, setExisting] = useState<Testimonial | null>(null);
  const [quote, setQuote] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await listTestimonials();
        const mine = all.find((x) => x.student_id === studentId) ?? null;
        if (cancelled) return;
        setExisting(mine);
        if (mine) {
          setQuote(mine.quote ?? '');
          setChannels(mine.consent_channels ?? []);
          setConsent(mine.consent_given);
          setGuardian(mine.guardian_consent);
          setNote(mine.consent_note ?? '');
        }
      } catch { /* a new testimonial simply starts empty */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const toggleChannel = (value: string) =>
    setChannels((prev) => prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]);

  /**
   * Save, and optionally approve in the same click.
   *
   * The dialog used to close on save, which meant the Approve button - only rendered
   * once a testimonial exists - was never reachable on the first pass. An approver
   * filled the form, saw "pending", and had no obvious way forward. Now the dialog
   * stays open with the saved record loaded, and approvers get a single
   * "Save & approve" action.
   */
  const save = async (thenApprove = false) => {
    setBusy(true);
    setError(null);
    try {
      let saved = await upsertTestimonial({
        student_id: studentId,
        quote: quote.trim() || null,
        exam_result_id: examResultId ?? null,
        consent_given: consent,
        consent_channels: channels,
        guardian_consent: guardian,
        consent_note: note.trim() || null,
      });

      if (photo) {
        try {
          saved = await uploadTestimonialPhoto(saved.id, photo);
          setPhoto(null);
        } catch {
          setExisting(saved);
          setError(t('teacherInsights.testimonial.photoUploadFailed'));
          onSaved?.();
          setBusy(false);
          return;
        }
      }

      if (thenApprove) {
        try {
          saved = await approveTestimonial(saved.id);
        } catch (e: any) {
          const detail = e?.response?.data?.detail;
          setExisting(saved);
          setError(typeof detail === 'string' ? detail : t('teacherInsights.testimonial.approvalFailed'));
          onSaved?.();
          setBusy(false);
          return;
        }
      }

      setExisting(saved);
      setSavedNotice(
        saved.is_marketing_ready
          ? t('teacherInsights.testimonial.savedApproved')
          : canApprove
            ? t('teacherInsights.testimonial.savedCanApprove')
            : t('teacherInsights.testimonial.savedNeedsApproval'),
      );
      onSaved?.();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('teacherInsights.testimonial.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!existing) return;
    setBusy(true); setError(null);
    try {
      const out = await approveTestimonial(existing.id);
      setExisting(out);
      setSavedNotice(t('teacherInsights.testimonial.approved'));
      onSaved?.();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('teacherInsights.testimonial.approveFailed'));
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!existing) return;
    const reason = window.prompt(t('teacherInsights.testimonial.revokePrompt')) ?? undefined;
    setBusy(true); setError(null);
    try {
      setExisting(await revokeTestimonial(existing.id, reason));
      onSaved?.();
    } catch {
      setError(t('teacherInsights.testimonial.revokeFailed'));
    } finally { setBusy(false); }
  };

  const consentIncomplete = consent && channels.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
         role="dialog" aria-modal="true" aria-labelledby="tst-title"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="tst-title" className="text-lg font-semibold">{t('teacherInsights.testimonial.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{studentName}</p>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
            {existing && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded px-2 py-0.5 bg-muted font-medium">{STATUS_LABEL[existing.status] ? t(STATUS_LABEL[existing.status]) : existing.status}</span>
                {existing.is_marketing_ready && (
                  <span className="rounded px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {t('teacherInsights.testimonial.availableToSales')}
                  </span>
                )}
                {existing.has_photo && (
                  <button type="button"
                          onClick={() => openTestimonialPhoto(existing.id).catch(
                            () => setError(t('teacherInsights.testimonial.openPhotoFailed')))}
                          className="text-primary hover:underline">{t('teacherInsights.testimonial.viewPhoto')}</button>
                )}
              </div>
            )}

            {existing?.revoked_at && (
              <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                {t('teacherInsights.testimonial.withdrawnNotice', { date: formatDate(existing.revoked_at) })}
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="tst-quote" className="text-xs font-medium">{t('exams.testimonial.quote')}</label>
                <textarea id="tst-quote" rows={4} value={quote}
                          onChange={(e) => setQuote(e.target.value)}
                          disabled={!!existing?.revoked_at}
                          placeholder={t('teacherInsights.testimonial.quotePlaceholder')}
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>

              <div>
                <label htmlFor="tst-photo" className="text-xs font-medium">{t('teacherInsights.testimonial.studentPhoto')}</label>
                <input id="tst-photo" type="file" accept="image/jpeg,image/png,image/webp"
                       disabled={!!existing?.revoked_at}
                       onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                       className="mt-1 block w-full text-sm" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t('teacherInsights.testimonial.photoHint')}
                </p>
              </div>

              <fieldset className="rounded-md border p-3">
                <legend className="px-1 text-xs font-semibold">{t('teacherInsights.testimonial.consent')}</legend>

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={consent} className="mt-0.5"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    {t('teacherInsights.testimonial.consentStudent')}
                  </span>
                </label>

                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={guardian} className="mt-0.5"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setGuardian(e.target.checked)} />
                  <span>
                    {t('teacherInsights.testimonial.consentGuardian')}
                    <span className="text-muted-foreground"> {t('teacherInsights.testimonial.consentGuardianHint')}</span>
                  </span>
                </label>

                <div className="mt-3">
                  <span className="text-xs font-medium">{t('teacherInsights.testimonial.agreedChannels')}</span>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {CHANNELS.map((c) => (
                      <label key={c.value} className="flex items-start gap-2 text-xs">
                        <input type="checkbox" checked={channels.includes(c.value)} className="mt-0.5"
                               disabled={!!existing?.revoked_at}
                               onChange={() => toggleChannel(c.value)} />
                        <span>{t(c.label)} <span className="text-muted-foreground">— {t(c.hint)}</span></span>
                      </label>
                    ))}
                  </div>
                  {consentIncomplete && (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">
                      {t('teacherInsights.testimonial.channelsRequired')}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <label htmlFor="tst-note" className="text-xs font-medium">
                    {t('teacherInsights.testimonial.consentHow')}
                  </label>
                  <Input id="tst-note" value={note} className="mt-1"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setNote(e.target.value)}
                         placeholder={t('teacherInsights.testimonial.consentHowPlaceholder')} />
                </div>

                {existing?.consent_recorded_at && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t('teacherInsights.testimonial.consentRecorded', { date: formatDate(existing.consent_recorded_at) })}
                  </p>
                )}
              </fieldset>
            </div>

            {savedNotice && (
              <p className="mt-3 rounded-md bg-green-50 dark:bg-green-900/30 px-3 py-2 text-xs text-green-800 dark:text-green-300"
                 role="status">{savedNotice}</p>
            )}
            {existing && existing.status === 'pending' && !existing.revoked_at && (
              <p className="mt-3 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <strong>{t('teacherInsights.testimonial.whyPending')}</strong> {t('teacherInsights.testimonial.whyPendingBody')}
                {' '}{canApprove
                  ? t('teacherInsights.testimonial.whyPendingSelf')
                  : t('teacherInsights.testimonial.whyPendingOthers')}
              </p>
            )}
            {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {existing && !existing.revoked_at && (
                <Button variant="outline" size="sm" onClick={revoke} disabled={busy}>
                  {t('teacherInsights.testimonial.withdrawConsent')}
                </Button>
              )}
              {canApprove && existing && existing.status !== 'approved' && !existing.revoked_at && (
                <Button variant="secondary" size="sm" onClick={approve}
                        disabled={busy || !existing.consent_given}
                        title={!existing.consent_given ? t('teacherInsights.testimonial.consentFirst') : undefined}>
                  {t('teacherInsights.testimonial.approveForSales')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{t('common.close')}</Button>
              {!existing?.revoked_at && (
                <Button variant="secondary" size="sm" onClick={() => save(false)}
                        disabled={busy || consentIncomplete}>
                  {busy ? t('teacherInsights.shared.saving') : t('common.save')}
                </Button>
              )}
              {canApprove && !existing?.revoked_at && (
                <Button size="sm" onClick={() => save(true)}
                        disabled={busy || consentIncomplete || !consent}
                        title={!consent ? t('teacherInsights.testimonial.recordConsentFirst') : undefined}>
                  {busy ? t('teacherInsights.shared.saving') : t('teacherInsights.testimonial.saveApprove')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TestimonialDialog;
