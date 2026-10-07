/**
 * «Your SAT/IELTS test date»: saves the planned date through PATCH /assignment-zero/planned-date,
 * the field curators read to follow up on results on time. Shared by the dashboard countdown and
 * the profile. SAT offers its official dates as chips; IELTS (or any other date) is typed in.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/api';
import type { ExamKind } from '@/services/api/assignment-zero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

export const EXAM_LABEL: Record<ExamKind, string> = { sat: 'SAT', ielts: 'IELTS' };

interface ExamDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ExamKind;
  /** The date already on file (ISO), if any. */
  current: string | null | undefined;
  /** Upcoming official SAT dates (ISO). */
  officialDates?: string[];
  onSaved: () => void;
}

export default function ExamDateDialog({ open, onOpenChange, kind, current, officialDates = [], onSaved }: ExamDateDialogProps) {
  const t = useT();
  const navigate = useNavigate();
  const [dateValue, setDateValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsAssignmentZero, setNeedsAssignmentZero] = useState(false);

  // Every opening starts from the date on file.
  useEffect(() => {
    if (!open) return;
    setDateValue(current ? current.slice(0, 10) : '');
    setError('');
    setNeedsAssignmentZero(false);
  }, [open, kind, current]);

  const save = async () => {
    if (!dateValue) {
      setError(t('exams.date.choose'));
      return;
    }
    try {
      setSaving(true);
      setError('');
      await apiClient.updateAssignmentZeroPlannedDate({ exam_type: kind, planned_test_date: dateValue });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNeedsAssignmentZero(true);
      else setError(t('exams.date.failed'));
    } finally {
      setSaving(false);
    }
  };

  const chips = kind === 'sat' ? officialDates : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('exams.date.title', { exam: EXAM_LABEL[kind] })}</DialogTitle>
          <DialogDescription>{kind === 'sat' ? t('exams.date.satHint') : t('exams.date.ieltsHint')}</DialogDescription>
        </DialogHeader>

        {needsAssignmentZero ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('exams.date.needsAssignmentZero')}</p>
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate('/assignment-zero');
              }}
            >
              {t('exams.date.goToAssignmentZero')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {chips.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('exams.date.official')}</p>
                <div className="flex flex-wrap gap-2">
                  {chips.map((d) => {
                    const iso = d.slice(0, 10);
                    const selected = dateValue === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setDateValue(iso)}
                        aria-pressed={selected}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? 'border-brand-solid bg-brand-solid text-brand-solid-foreground'
                            : 'border-border hover:border-brand-border hover:bg-brand-surface'
                        }`}
                      >
                        {formatDate(iso)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="exam-date-input" className="mb-1 block text-xs font-medium text-muted-foreground">
                {chips.length > 0 ? t('exams.date.other') : t('exams.date.label')}
              </label>
              <Input id="exam-date-input" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>

            <p className="text-[11px] text-muted-foreground">{t('exams.date.curatorNote')}</p>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !dateValue}>
                {saving ? t('exams.date.saving') : t('exams.date.save')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
