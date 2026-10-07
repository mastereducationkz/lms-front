import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Dices, Loader2, XCircle, Zap } from 'lucide-react';
import type { LiveApi } from '../../lib/liveLesson/api';
import { correctIndices, mineAt, optionLabel } from '../../lib/liveLesson/logic';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import type { ActivityView, LiveRecord } from '../../lib/liveLesson/types';
import { stampKz } from '../../lib/classLessonPage';
import StaffActivity from './StaffActivity';
import { ReactionGlyph } from './reactionIcons';
import { CloudView, OptionRows, QuestionBody, activityKindKey } from './parts';

/**
 * The lesson page's record of its live activities (owner, 2026-09-29): staff see every activity with
 * its results, who answered what, picker turns and the suggested scores; a student sees only their own
 * answers (a pop-check's key once shown, no poll totals).
 */
export default function LiveRecordList({ eventId, api, refreshKey }: { eventId: number; api: LiveApi; refreshKey?: unknown }) {
  const t = useT();
  const locale = useLocale();
  const [record, setRecord] = useState<LiveRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.record(eventId).then((r) => { if (alive) setRecord(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, eventId, refreshKey]);
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!record) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!record.activities.length) {
    return <p className="text-sm text-muted-foreground">{record.is_staff ? t('chatLive.live.noActivities') : t('chatLive.live.noAnswersMine')}</p>;
  }
  return (
    <div className="space-y-3">
      {(record.crowned || (record.energy && record.energy.total > 0)) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-primary/5 px-3 py-2 text-sm">
          {record.energy && record.energy.total > 0 && (
            <span className="inline-flex items-center gap-1"><Zap className="h-4 w-4 text-amber-500" aria-hidden />{t('chatLive.live.energy')} <b>{record.energy.total}</b> {t('chatLive.live.reactionsWord', { count: record.energy.total })}{record.energy.top ? <>, <ReactionGlyph kind={record.energy.top} /> {t('chatLive.live.mostUsed')}</> : null}</span>
          )}
          {record.crowned && <span className="inline-flex items-center gap-1"><Crown className="h-4 w-4 text-amber-500" aria-hidden />{t('chatLive.live.crownedLabel')} <b>{record.crowned.name}</b></span>}
        </div>
      )}
      {record.activities.map((a) => (
        <div key={a.id} className="rounded-xl border border-border p-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">{stampKz(a.started_at, locale)}</p>
          {record.is_staff ? <StaffActivity activity={a} /> : <Mine activity={a} />}
        </div>
      ))}
      {record.is_staff && record.picks && record.picks.length > 0 && (
        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Dices className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.picked')}
          </p>
          <ul className="space-y-0.5">
            {record.picks.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="text-muted-foreground">
                  {p.outcome === 'answered' ? t('chatLive.live.picks.answered') : p.outcome === 'no_answer' ? t('chatLive.live.picks.noAnswer') : p.outcome === 'skipped' ? t('chatLive.live.picks.skipped') : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Mine({ activity }: { activity: ActivityView }) {
  const t = useT();
  const heading = activity.kind === 'popcheck' ? t('chatLive.live.homeworkPopcheck') : activity.kind === 'mistake' ? t('chatLive.live.kind.mistake') : activity.prompt;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs font-semibold text-muted-foreground">{t(activityKindKey(activity.kind))}</p>
      {heading && <p className="font-semibold text-foreground">{heading}</p>}
      {activity.kind === 'poll' && typeof activity.mine === 'number' && (
        <p>{t('chatLive.live.yourAnswer')} <b>{optionLabel(activity.mine, activity.options?.[activity.mine])}</b></p>
      )}
      {activity.kind === 'cloud' && Array.isArray(activity.mine) && (
        <CloudView groups={(activity.mine as { text: string }[]).map((m) => ({ text: m.text, count: 1 }))} />
      )}
      {activity.kind === 'mistake' && activity.question && (
        <>
          <QuestionBody question={activity.question} />
          <OptionRows options={activity.question.options ?? []} rich
            selected={Array.isArray(activity.mine) ? activity.mine as number[] : typeof activity.mine === 'number' ? [activity.mine] : []}
            correct={activity.results ? correctIndices(activity.results.correct) : undefined} />
        </>
      )}
      {activity.kind === 'popcheck' && (activity.items ?? []).map((item, i) => {
        const mine = mineAt<{ value: unknown; correct: boolean | null }>(activity.mine, i);
        if (!mine) return null;
        return (
          <div key={i} className="rounded-lg border border-border p-2">
            <QuestionBody question={item.question} />
            {item.question.options ? (
              <OptionRows options={item.question.options} rich
                selected={Array.isArray(mine.value) ? mine.value as number[] : typeof mine.value === 'number' ? [mine.value] : []}
                correct={item.key ? correctIndices(item.key.correct) : undefined} />
            ) : <p>{t('chatLive.live.yourAnswer')} <b>{String(mine.value ?? '')}</b></p>}
            {mine.correct != null && (
              <p className={mine.correct ? 'mt-1 inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400' : 'mt-1 inline-flex items-center gap-1 text-rose-600 dark:text-rose-400'}>
                {mine.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                {mine.correct ? t('chatLive.live.right') : t('chatLive.live.notQuite')}
              </p>
            )}
            {!item.question.options && item.key && Array.isArray(item.key.correct) && (
              <p className="mt-1 text-xs">{t('chatLive.live.rightAnswer')} <b>{(item.key.correct as string[]).join(t('chatLive.live.answersJoin'))}</b></p>
            )}
          </div>
        );
      })}
    </div>
  );
}
