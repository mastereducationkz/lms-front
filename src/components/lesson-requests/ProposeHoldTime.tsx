import { useState } from 'react';
import type { LessonRequest } from '../../types';
import { proposeHoldTime } from '../../services/api';
import { formatDateTime } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { fromDatetimeLocalKZ } from '../../lib/datetime';
import { newTimeProblem } from '../../lib/lessonHold';
import { toast } from '../Toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import '@/lib/i18n/catalogs/lessonRequests';

/**
 * «Временная отмена»: the teacher whose lesson is on hold proposes its new time. Nothing moves — the head
 * teacher confirms it with one click (or sets another time) — so this only says what was proposed and offers to
 * change it. A past time is refused before it is sent; a clash with another lesson of the group is the server's
 * to know, and it says so in the user's language.
 */
export default function ProposeHoldTime({ req, onChanged }: { req: LessonRequest; onChanged: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = newTimeProblem(value);
  const proposed = req.hold_proposed_datetime;

  const send = async () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await proposeHoldTime(req.id, fromDatetimeLocalKZ(value));
      toast(t('lessonRequests.hold.propose.sent'), 'success');
      setOpen(false);
      setValue('');
      onChanged();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' && detail.trim() ? detail : t('lessonRequests.holds.error.action'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {proposed && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t('lessonRequests.hold.propose.yours', {
            when: formatDateTime(proposed, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          })}
        </p>
      )}
      {!open ? (
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(true)}>
          {proposed ? t('lessonRequests.hold.propose.change') : t('lessonRequests.hold.propose.open')}
        </Button>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('lessonRequests.holds.newTime')}
            <Input
              type="datetime-local"
              className="h-9 w-[220px]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={showProblem && !!problem}
            />
          </label>
          <Button type="button" size="sm" onClick={send} disabled={busy}>
            {t('lessonRequests.hold.propose.send')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {t('lessonRequests.holds.close')}
          </Button>
          {showProblem && problem && (
            <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-300">
              {t(problem === 'empty' ? 'lessonRequests.holds.problem.empty' : 'lessonRequests.holds.problem.past')}
            </p>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
