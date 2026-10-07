/**
 * Star of the Week (owner, 2026-10-04): the group's teacher OR curator awards one student a week
 * (one per role per group per week), with a short reason the student sees on their page.
 */
import { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/Toast';
import { STAR_REASON_MAX, starQuota, starQuotaLabel, validStarReason } from '@/lib/achievements';
import { useLocale, useT } from '@/lib/i18n/react';
import { awardStar, getGroupStars, type GroupStars } from '@/services/api/achievementsUi';
import '@/lib/i18n/catalogs/achievements';

interface StarOfWeekButtonProps {
  groupId: number;
  students: { id: number; name: string }[];
}

export function StarOfWeekButton({ groupId, students }: StarOfWeekButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-yellow-300 text-xs text-yellow-800 hover:bg-yellow-50 hover:dark:bg-yellow-500/15 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/30"
        onClick={() => setOpen(true)}
        disabled={students.length === 0}
        data-tip="star-of-week"
      >
        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" aria-hidden />
        {t('achievements.star.title')}
      </Button>
      {open && <StarOfWeekDialog groupId={groupId} students={students} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Also opened straight from the live lesson's «Also give Star of the Week?», prefilled (2026-10-04). */
export function StarOfWeekDialog({ groupId, students, onClose, initialStudentId }: StarOfWeekButtonProps & {
  onClose: () => void; initialStudentId?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [stars, setStars] = useState<GroupStars | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [studentId, setStudentId] = useState<number | ''>(initialStudentId ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoadError(false);
    getGroupStars(groupId).then(setStars).catch(() => setLoadError(true));
  };
  useEffect(load, [groupId]);

  const left = stars ? starQuota(stars) : 0;
  const canSubmit = left > 0 && studentId !== '' && validStarReason(reason) && !saving;

  const submit = () => {
    if (!canSubmit || typeof studentId !== 'number') return;
    setSaving(true);
    setError(null);
    awardStar({ student_id: studentId, group_id: groupId, reason: reason.trim() })
      .then(() => {
        const name = students.find((s) => s.id === studentId)?.name ?? '';
        toast(t('achievements.star.awarded', { name }), 'success');
        onClose();
      })
      .catch((e: Error) => {
        setError(e.message);
        load();
      })
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-500" aria-hidden />
            {t('achievements.star.title')}
          </DialogTitle>
          <DialogDescription>
            {t('achievements.star.description')}
          </DialogDescription>
        </DialogHeader>

        {!stars && !loadError && (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden /></div>
        )}
        {loadError && (
          <p className="text-sm text-red-600 dark:text-red-300">{t('achievements.star.loadFailed')}</p>
        )}

        {stars && (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm ${left > 0 ? 'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200' : 'bg-gray-50 dark:bg-muted text-muted-foreground'}`}>
              {stars.can_award ? starQuotaLabel(left, locale) : t('achievements.star.onlyGroupStaff')}
            </p>

            {left > 0 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">{t('achievements.star.student')}</span>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t('achievements.star.chooseStudent')}</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-sm font-medium">
                    {t('achievements.star.reason')}
                    <span className={`text-xs font-normal ${reason.trim().length > STAR_REASON_MAX ? 'text-red-600 dark:text-red-300' : 'text-muted-foreground'}`}>
                      {reason.trim().length}/{STAR_REASON_MAX}
                    </span>
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={STAR_REASON_MAX + 20}
                    placeholder={t('achievements.star.reasonPlaceholder')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

            {stars.this_week.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('achievements.star.thisWeek')}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {stars.this_week.map((s, i) => (
                    <li key={`${s.created_at}-${i}`} className="text-sm text-foreground">
                      <Star className="mr-1 inline h-3.5 w-3.5 fill-current text-amber-500" aria-hidden /> {s.student_name ?? `#${s.student_id}`} — <span className="text-muted-foreground">{s.awarded_by_name}: «{s.reason}»</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              {left > 0 && (
                <Button type="button" disabled={!canSubmit} onClick={submit} className="bg-yellow-500 text-yellow-950 hover:bg-yellow-400">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {t('achievements.star.award')}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
