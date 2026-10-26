import { useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import {
  changeReady, evidenceLine, markLabel, pickMark, reasonPresets, toChange,
  type CellMark, type MarkChange, type PickMark,
} from '../../lib/registerLock';
import type { OverrideReason } from '../../lib/meetRegister';
import type { MeetReviewOptions } from '../../services/api/meetAttendance';
import type { RegisterLock, StudentRegister } from '../../services/api/meetRegister';
import '@/lib/i18n/catalogs/attendance';

const MARKS: { key: PickMark; tone: string }[] = [
  { key: 'attended', tone: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'late', tone: 'bg-amber-500 text-white border-amber-500' },
  { key: 'missed', tone: 'bg-rose-600 text-white border-rose-600' },
];

interface Props {
  /** The cell as it stands now (a lesson page row or a journal cell). */
  current: CellMark & { note?: string | null };
  /** What Meet says about this student: the minutes behind its mark. */
  register: StudentRegister | undefined;
  /** The scheduled length of the lesson, for «38 из 60 мин». */
  lessonMinutes: number | null;
  lock: RegisterLock | null | undefined;
  options: MeetReviewOptions | null | undefined;
  onApply: (change: MarkChange) => void;
  onCancel: () => void;
}

/**
 * A locked cell's way out (owner, 2026-10-17): Meet's evidence, the new mark and a reason. Every change
 * of a mark Meet decided needs one — present↔late and excuses included — so nothing here applies until
 * the reason is complete («Другое» needs words). Once a teacher's window has closed, the form says only
 * a head teacher can change it. Shared by the journal's popover and the lesson page's row.
 */
export function MeetMarkForm({ current, register, lessonMinutes, lock, options, onApply, onCancel }: Props) {
  const t = useT();
  const locale = useLocale();
  const reasonId = useId();
  const now = pickMark(current.status);
  const [status, setStatus] = useState<PickMark>(now);
  const [excused, setExcused] = useState(Boolean(current.excused) && now === 'missed');
  const [note, setNote] = useState(current.note ?? '');
  const [reason, setReason] = useState<OverrideReason>({ code: '', text: null });

  const evidence = evidenceLine(register, lessonMinutes, locale);
  const meetMark = register?.verdict ?? register?.status ?? null;
  const meetWord = meetMark ? markLabel(meetMark, locale) : null;
  const presets = useMemo(() => reasonPresets(options, register, status, locale), [options, register, status, locale]);
  const ready = changeReady(current, { status, excused, note, reason });
  const closes = lock?.override_closes_at ?? null;

  return (
    <div className="space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('attendance.popover.title')}</div>
        <div className="mt-1 text-foreground">
          {meetWord ? t('attendance.popover.meetSays', { mark: meetWord }) : markLabel(current.status, locale)}
          {evidence ? <span className="text-muted-foreground"> — {evidence}</span> : null}
        </div>
      </div>

      {lock?.may_override === false ? (
        <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">{t('attendance.popover.closed')}</p>
      ) : (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{t('attendance.popover.newMark')}</div>
            <div className="flex overflow-hidden rounded-lg border border-border" role="radiogroup" aria-label={t('attendance.popover.newMark')}>
              {MARKS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={status === m.key}
                  onClick={() => { setStatus(m.key); if (m.key !== 'missed') setExcused(false); }}
                  className={cn('flex-1 px-2 py-1.5 text-xs font-semibold transition', status === m.key ? m.tone : 'bg-card text-foreground hover:bg-muted')}
                >
                  {markLabel(m.key, locale)}
                </button>
              ))}
            </div>
            {status === 'missed' && (
              <div className="mt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                  <input type="checkbox" checked={excused} onChange={(e) => setExcused(e.target.checked)} className="h-3.5 w-3.5" />
                  {t('attendance.popover.excused')}
                </label>
                {excused && (
                  <textarea
                    aria-label={t('attendance.excuse.reasonLabel')}
                    value={note}
                    rows={2}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('attendance.excuse.placeholder')}
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-base md:text-xs"
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={reasonId}>{t('attendance.popover.reasonLabel')}</label>
            <select
              id={reasonId}
              value={reason.code}
              onChange={(e) => setReason({ code: e.target.value, text: e.target.value === 'other' ? reason.text : null })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-base md:text-xs"
            >
              <option value="" disabled>{t('attendance.popover.choose')}</option>
              {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {reason.code === 'other' && (
              <textarea
                aria-label={t('attendance.popover.describe')}
                value={reason.text ?? ''}
                rows={2}
                maxLength={500}
                onChange={(e) => setReason({ code: 'other', text: e.target.value })}
                placeholder={t('attendance.popover.describe')}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-base md:text-xs"
              />
            )}
          </div>

          {closes && (
            <p className="text-[11px] text-muted-foreground">
              {t('attendance.popover.closesOn', { date: formatDate(closes, { day: 'numeric', month: 'short' }, locale) })}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          {t('common.cancel')}
        </button>
        {lock?.may_override !== false && (
          <button type="button" disabled={!ready} onClick={() => onApply(toChange({ status, excused, note, reason }))}
            className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {t('attendance.popover.apply')}
          </button>
        )}
      </div>
    </div>
  );
}

export default MeetMarkForm;
