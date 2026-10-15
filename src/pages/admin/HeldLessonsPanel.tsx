import { useCallback, useEffect, useState } from 'react';
import type { CancelResolution, LessonRequest } from '../../types';
import { confirmHoldProposal, convertHoldToCancel, declineHoldProposal, getWaitingHolds, restoreHold, setHoldTime } from '../../services/api';
import { formatDateTime, type MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { fromDatetimeLocalKZ } from '../../lib/datetime';
import { canRestoreHold, daysWaiting, hasProposal, newTimeProblem } from '../../lib/lessonHold';
import { toast } from '../../components/Toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import '@/lib/i18n/catalogs/lessonRequests';

/**
 * «Временная отмена»: the lessons that were put on hold and still have no new time.
 *
 * Each is off the calendar and out of every notification; this is where somebody says when it comes
 * back, turns it into a real cancellation, or puts it back at its original time. Everything the page
 * can do is one of those three; the server decides what is allowed and says so in the user's language.
 */

type Panel = { id: number; mode: 'time' | 'cancel' } | null;

const formatExact = (value?: string | null) =>
  value
    ? formatDateTime(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const RESOLUTIONS: { value: CancelResolution; label: MessageKey; hint: MessageKey }[] = [
  { value: 'cancel_only', label: 'lessonRequests.cancel.cancelOnly', hint: 'lessonRequests.cancel.cancelOnlyHint' },
  { value: 'add_replacement', label: 'lessonRequests.cancel.addReplacement', hint: 'lessonRequests.cancel.addReplacementHint' },
];

export default function HeldLessonsPanel({ onCount }: { onCount?: (waiting: number) => void }) {
  const t = useT();
  const [holds, setHolds] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [newTime, setNewTime] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [resolution, setResolution] = useState<CancelResolution>('cancel_only');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await getWaitingHolds();
      setHolds(rows);
      onCount?.(rows.length);
    } catch {
      setError(t('lessonRequests.holds.error.load'));
    } finally {
      setLoading(false);
    }
  }, [onCount, t]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (id: number, mode: 'time' | 'cancel') => {
    setPanel(panel?.id === id && panel.mode === mode ? null : { id, mode });
    setNewTime('');
    setShowProblem(false);
    setResolution('cancel_only');
  };

  /** The server's own sentence, already in the reader's language when it carries a code. */
  const failure = (err: any): string => {
    const detail = err?.response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : t('lessonRequests.holds.error.action');
  };

  const run = async (id: number, action: () => Promise<unknown>, done: string) => {
    try {
      setBusy(id);
      setError(null);
      await action();
      toast(done, 'success');
      setPanel(null);
      await load();
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(null);
    }
  };

  const saveTime = (req: LessonRequest) => {
    if (newTimeProblem(newTime)) {
      setShowProblem(true);
      return;
    }
    run(req.id, () => setHoldTime(req.id, fromDatetimeLocalKZ(newTime)), t('lessonRequests.holds.done.scheduled'));
  };

  const problem = newTimeProblem(newTime);

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b">
        <CardTitle className="text-lg">{t('lessonRequests.holds.title')}</CardTitle>
        <CardDescription>
          {t('lessonRequests.holds.description')}{' '}
          {!loading && <strong>{t('lessonRequests.holds.found', { count: holds.length })}</strong>}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[10rem]">{t('lessonRequests.col.groupLesson')}</TableHead>
              <TableHead>{t('lessonRequests.detail.originalTime')}</TableHead>
              <TableHead>{t('lessonRequests.col.teacher')}</TableHead>
              <TableHead>{t('lessonRequests.holds.col.waiting')}</TableHead>
              <TableHead>{t('lessonRequests.detail.reason')}</TableHead>
              <TableHead className="text-right">{t('lessonRequests.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{t('common.loading')}</TableCell>
              </TableRow>
            ) : holds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{t('lessonRequests.holds.empty')}</TableCell>
              </TableRow>
            ) : (
              holds.map(req => {
                const days = daysWaiting(req.resolved_at);
                const restorable = canRestoreHold(req);
                const working = busy === req.id;
                return [
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="font-medium">{req.group_name || t('lessonRequests.row.group', { id: req.group_id })}</div>
                      <div className="text-xs text-muted-foreground">{req.lesson_title || '—'}</div>
                      {hasProposal(req) && (
                        <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          {t('lessonRequests.holds.proposed', { when: formatExact(req.hold_proposed_datetime) })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatExact(req.lesson_start_datetime ?? req.original_datetime)}</TableCell>
                    <TableCell>{req.requester_name || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {days === null ? '—' : days === 0 ? t('lessonRequests.holds.today') : t('lessonRequests.holds.days', { count: days })}
                    </TableCell>
                    <TableCell className="max-w-[16rem] break-words text-sm text-muted-foreground">{req.reason || '—'}</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {hasProposal(req) ? (
                          <>
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => run(req.id, () => confirmHoldProposal(req.id), t('lessonRequests.holds.done.scheduled'))}
                              disabled={working}
                            >
                              {t('lessonRequests.holds.confirm')}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => open(req.id, 'time')} disabled={working}>
                              {t('lessonRequests.holds.otherTime')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => run(req.id, () => declineHoldProposal(req.id), t('lessonRequests.holds.done.declined'))}
                              disabled={working}
                            >
                              {t('lessonRequests.holds.decline')}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="h-8 text-xs" onClick={() => open(req.id, 'time')} disabled={working}>
                            {t('lessonRequests.holds.setTime')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => run(req.id, () => restoreHold(req.id), t('lessonRequests.holds.done.restored'))}
                          disabled={working || !restorable}
                          title={restorable ? undefined : t('lessonRequests.holds.restoreGone')}
                        >
                          {t('lessonRequests.holds.restore')}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => open(req.id, 'cancel')} disabled={working}>
                          {t('lessonRequests.holds.cancelLesson')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>,

                  panel?.id === req.id && (
                    <TableRow key={`${req.id}-panel`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="p-4">
                        {panel.mode === 'time' ? (
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              {t('lessonRequests.holds.newTime')}
                              <Input
                                type="datetime-local"
                                className="h-9 w-[220px]"
                                value={newTime}
                                onChange={e => setNewTime(e.target.value)}
                                aria-invalid={showProblem && !!problem}
                              />
                            </label>
                            <Button size="sm" onClick={() => saveTime(req)} disabled={working}>{t('lessonRequests.holds.save')}</Button>
                            <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>{t('lessonRequests.holds.close')}</Button>
                            {showProblem && problem && (
                              <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-300">
                                {t(problem === 'empty' ? 'lessonRequests.holds.problem.empty' : 'lessonRequests.holds.problem.past')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <fieldset className="space-y-2">
                              <legend className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {t('lessonRequests.decision.legend')}
                              </legend>
                              {RESOLUTIONS.map(opt => (
                                <label key={opt.value} className="flex cursor-pointer items-start gap-2 text-sm">
                                  <input
                                    type="radio"
                                    className="mt-1 shrink-0"
                                    name={`hold-cancel-${req.id}`}
                                    checked={resolution === opt.value}
                                    onChange={() => setResolution(opt.value)}
                                    disabled={working}
                                  />
                                  <span>
                                    <span className="font-medium">{t(opt.label)}</span>
                                    <span className="block text-xs text-muted-foreground">— {t(opt.hint)}</span>
                                  </span>
                                </label>
                              ))}
                            </fieldset>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => run(req.id, () => convertHoldToCancel(req.id, resolution), t('lessonRequests.holds.done.cancelled'))}
                                disabled={working}
                              >
                                {t('lessonRequests.holds.confirmCancel')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>{t('lessonRequests.holds.close')}</Button>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                ];
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
