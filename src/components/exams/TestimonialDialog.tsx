import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  approveTestimonial,
  listTestimonials,
  revokeTestimonial,
  testimonialPhotoUrl,
  upsertTestimonial,
  uploadTestimonialPhoto,
  type Testimonial,
} from '../../services/api/exams';

/**
 * Collect a student's photo and отзыв for the sales team, with the consent record.
 *
 * Consent is the point of this dialog, not an afterthought. The subjects are frequently
 * minors and the material is used in advertising, so saving requires stating which
 * channels the student agreed to and confirming the permission was actually obtained.
 * Approval is refused server-side without that record, and revocation is always
 * available because consent that cannot be withdrawn is not consent.
 */

const CHANNELS: { value: string; label: string; hint: string }[] = [
  { value: 'website', label: 'Website', hint: 'mastereducation.kz pages' },
  { value: 'social', label: 'Social media', hint: 'Instagram, Telegram, etc.' },
  { value: 'ads', label: 'Paid advertising', hint: 'promoted posts and campaigns' },
  { value: 'print', label: 'Print', hint: 'leaflets, banners' },
  { value: 'internal', label: 'Internal only', hint: 'not shown publicly' },
];

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

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await upsertTestimonial({
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
          await uploadTestimonialPhoto(saved.id, photo);
        } catch {
          setError('Saved, but the photo upload failed. Try attaching it again.');
          setExisting(saved);
          setBusy(false);
          return;
        }
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save.');
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!existing) return;
    setBusy(true); setError(null);
    try {
      setExisting(await approveTestimonial(existing.id));
      onSaved?.();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not approve.');
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!existing) return;
    const reason = window.prompt('Reason for withdrawing consent (optional):') ?? undefined;
    setBusy(true); setError(null);
    try {
      setExisting(await revokeTestimonial(existing.id, reason));
      onSaved?.();
    } catch {
      setError('Could not revoke.');
    } finally { setBusy(false); }
  };

  const consentIncomplete = consent && channels.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
         role="dialog" aria-modal="true" aria-labelledby="tst-title"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="tst-title" className="text-lg font-semibold">Testimonial &amp; photo</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{studentName}</p>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {existing && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded px-2 py-0.5 bg-muted font-medium">{existing.status}</span>
                {existing.is_marketing_ready && (
                  <span className="rounded px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    available to sales
                  </span>
                )}
                {existing.has_photo && (
                  <a href={testimonialPhotoUrl(existing.id)} target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline">view photo</a>
                )}
              </div>
            )}

            {existing?.revoked_at && (
              <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Consent was withdrawn on {existing.revoked_at.slice(0, 10)}. This material is
                no longer available to the sales team and cannot be edited.
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="tst-quote" className="text-xs font-medium">Отзыв / quote</label>
                <textarea id="tst-quote" rows={4} value={quote}
                          onChange={(e) => setQuote(e.target.value)}
                          disabled={!!existing?.revoked_at}
                          placeholder="What the student said about their result…"
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>

              <div>
                <label htmlFor="tst-photo" className="text-xs font-medium">Student photo</label>
                <input id="tst-photo" type="file" accept="image/jpeg,image/png,image/webp"
                       disabled={!!existing?.revoked_at}
                       onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                       className="mt-1 block w-full text-sm" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  JPEG, PNG or WEBP up to 8 MB. Stored privately; only staff who can already
                  see this student can open it.
                </p>
              </div>

              <fieldset className="rounded-md border p-3">
                <legend className="px-1 text-xs font-semibold">Consent</legend>

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={consent} className="mt-0.5"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    The student has agreed to their photo and words being used for marketing.
                  </span>
                </label>

                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={guardian} className="mt-0.5"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setGuardian(e.target.checked)} />
                  <span>
                    A parent or guardian has also agreed
                    <span className="text-muted-foreground"> — required if the student is under 18.</span>
                  </span>
                </label>

                <div className="mt-3">
                  <span className="text-xs font-medium">Agreed channels</span>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {CHANNELS.map((c) => (
                      <label key={c.value} className="flex items-start gap-2 text-xs">
                        <input type="checkbox" checked={channels.includes(c.value)} className="mt-0.5"
                               disabled={!!existing?.revoked_at}
                               onChange={() => toggleChannel(c.value)} />
                        <span>{c.label} <span className="text-muted-foreground">— {c.hint}</span></span>
                      </label>
                    ))}
                  </div>
                  {consentIncomplete && (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">
                      Choose at least one channel — agreeing to a website quote is not
                      agreeing to appear in paid advertising.
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <label htmlFor="tst-note" className="text-xs font-medium">
                    How consent was obtained
                  </label>
                  <Input id="tst-note" value={note} className="mt-1"
                         disabled={!!existing?.revoked_at}
                         onChange={(e) => setNote(e.target.value)}
                         placeholder="e.g. verbally at the centre, 8 Aug, mother present" />
                </div>

                {existing?.consent_recorded_at && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Consent recorded {existing.consent_recorded_at.slice(0, 10)}.
                  </p>
                )}
              </fieldset>
            </div>

            {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {existing && !existing.revoked_at && (
                <Button variant="outline" size="sm" onClick={revoke} disabled={busy}>
                  Withdraw consent
                </Button>
              )}
              {canApprove && existing && existing.status !== 'approved' && !existing.revoked_at && (
                <Button variant="secondary" size="sm" onClick={approve}
                        disabled={busy || !existing.consent_given}
                        title={!existing.consent_given ? 'Consent must be recorded first' : undefined}>
                  Approve for sales
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Close</Button>
              {!existing?.revoked_at && (
                <Button size="sm" onClick={save} disabled={busy || consentIncomplete}>
                  {busy ? 'Saving…' : 'Save'}
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
