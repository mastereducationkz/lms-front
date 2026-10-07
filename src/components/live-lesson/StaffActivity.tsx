import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LiveAvatar } from './orcas';
import { correctIndices, optionLabel } from '../../lib/liveLesson/logic';
import type { ActivityView, NamedAnswer } from '../../lib/liveLesson/types';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import { CloudView, OptionRows, QuestionBody, activityKindKey } from './parts';

/**
 * One activity as staff see it: live counts, who answered what (never for an anonymous one), the
 * pop-check keys, the cloud's entries with hide / restore. Used by the panel (open activity) and by
 * the lesson page's record (every activity, afterwards).
 */
export default function StaffActivity({ activity, onHide, names = true }: {
  activity: ActivityView;
  onHide?: (answerId: number, hidden: boolean) => void;
  /** The presenter view is shared on screen: no names there. */
  names?: boolean;
}) {
  const t = useT();
  const [showNames, setShowNames] = useState(false);
  const named = names && !activity.anonymous && activity.answers;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{t(activityKindKey(activity.kind))}</span>
        {activity.anonymous && <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" aria-hidden />{t('chatLive.live.anonymous')}</span>}
        <span>{activity.offered
          ? t('chatLive.live.answeredCountHere', { count: activity.answered, total: Math.max(activity.offered, activity.answered) })
          : t('chatLive.live.answeredCount', { count: activity.answered })}</span>
        <span className={cn('rounded-full px-1.5 py-px font-semibold', activity.status === 'open'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          : activity.revealed ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-muted text-muted-foreground')}>
          {activity.status === 'open' ? t('chatLive.live.status.open') : activity.revealed ? t('chatLive.live.status.shown') : t('chatLive.live.status.closed')}
        </span>
      </div>
      {activity.prompt && <p className="text-sm font-semibold text-foreground">{activity.prompt}</p>}
      <Body activity={activity} onHide={onHide} names={names} />
      {named && activity.kind !== 'popcheck' && activity.kind !== 'cloud' && (
        <div>
          <button type="button" onClick={() => setShowNames((v) => !v)} className="text-xs font-semibold text-primary">
            {showNames ? t('chatLive.live.hideWhoAnswered') : t('chatLive.live.whoAnswered')}
          </button>
          {showNames && <Answers activity={activity} answers={activity.answers ?? []} />}
        </div>
      )}
    </div>
  );
}

function optionText(activity: ActivityView, value: unknown): string {
  const options = activity.kind === 'poll' ? activity.options ?? [] : (activity.question?.options ?? []).map((o) => o.text);
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => (typeof v === 'number' ? optionLabel(v, options[v]) : String(v ?? ''))).join(', ');
}

function Answers({ activity, answers }: { activity: ActivityView; answers: NamedAnswer[] }) {
  const t = useT();
  if (!answers.length) return <p className="mt-1 text-xs text-muted-foreground">{t('chatLive.live.nobodyYet')}</p>;
  return (
    <ul className="mt-1 divide-y divide-border rounded-lg border border-border text-xs">
      {[...answers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map((a) => (
        <li key={a.user_id} className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="flex min-w-0 items-center gap-1.5"><LiveAvatar person={a} size={20} /><span className="truncate text-foreground">{a.name}</span></span>
          <span className={cn('flex-none', a.correct === true && 'text-emerald-700 dark:text-emerald-400', a.correct === false && 'text-rose-600 dark:text-rose-400')}>
            {optionText(activity, a.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Body({ activity, onHide, names }: { activity: ActivityView; onHide?: (id: number, hidden: boolean) => void; names: boolean }) {
  const t = useT();
  if (activity.kind === 'poll') {
    return <OptionRows options={activity.options ?? []} counts={activity.results?.counts ?? []} />;
  }
  if (activity.kind === 'mistake' && activity.question) {
    return (
      <div className="space-y-2 text-sm">
        {activity.stats && (
          <p className="text-xs text-muted-foreground">
            {t('chatLive.live.homeworkGotWrong', { percent: Math.round(activity.stats.share_wrong * 100), wrong: activity.stats.wrong, answered: activity.stats.answered })}
          </p>
        )}
        <QuestionBody question={activity.question} />
        <OptionRows options={activity.question.options ?? []} rich counts={activity.results?.counts ?? []}
          correct={correctIndices(activity.results?.correct)} />
      </div>
    );
  }
  if (activity.kind === 'cloud') {
    const entries = activity.entries ?? [];
    return (
      <div className="space-y-2">
        <CloudView groups={activity.results?.groups ?? []} />
        {entries.length > 0 && (
          <details className="rounded-lg border border-border text-xs">
            <summary className="cursor-pointer px-2 py-1.5 font-semibold text-foreground">
              {t('chatLive.live.entries', { count: entries.length })}{entries.some((e) => e.hidden) ? ` · ${t('chatLive.live.hiddenCount', { count: entries.filter((e) => e.hidden).length })}` : ''}
            </summary>
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-2 py-1">
                  <span className={cn('min-w-0 truncate', e.hidden && 'text-muted-foreground line-through')}>
                    {e.text}
                    {names && e.name && (
                      <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-muted-foreground">
                        · {e.user_id != null && <LiveAvatar person={{ user_id: e.user_id, name: e.name, mascot: e.mascot, avatar_url: e.avatar_url }} size={16} />}{e.name}
                      </span>
                    )}
                    {(e.hidden === 'filter' || e.hidden === 'ai') && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-400">{e.hidden === 'ai' ? t('chatLive.live.hiddenByAi') : t('chatLive.live.filtered')}</span>
                    )}
                  </span>
                  {onHide && (
                    <button type="button" onClick={() => onHide(e.id, !e.hidden)}
                      className="inline-flex flex-none items-center gap-1 font-semibold text-primary">
                      {e.hidden ? <><RotateCcw className="h-3 w-3" aria-hidden />{t('chatLive.live.restore')}</> : <><Eye className="h-3 w-3" aria-hidden />{t('chatLive.live.hide')}</>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }
  // pop-check
  const items = activity.items ?? [];
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-2 text-sm">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase text-muted-foreground">
            <span>{t('chatLive.live.question', { n: i + 1 })}</span>
            {item.answered != null && <span>{t('chatLive.live.rightOf', { right: item.right ?? 0, answered: item.answered })}</span>}
          </div>
          <QuestionBody question={item.question} />
          {item.question.options ? (
            <div className="mt-1.5"><OptionRows options={item.question.options} rich correct={correctIndices(item.key?.correct)} /></div>
          ) : item.key && (
            <p className="mt-1 text-xs">{t('chatLive.live.rightAnswer')} <b>{(item.key.correct as string[]).join(t('chatLive.live.answersJoin'))}</b></p>
          )}
        </div>
      ))}
      {names && activity.answers && activity.answers.length > 0 && (
        <details className="rounded-lg border border-border text-xs">
          <summary className="cursor-pointer px-2 py-1.5 font-semibold text-foreground">{t('chatLive.live.eachStudent')}</summary>
          <ul className="divide-y divide-border">
            {activity.answers.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="flex min-w-0 items-center gap-1.5"><LiveAvatar person={a} size={20} /><span className="truncate">{a.name}</span></span>
                <span className="flex flex-none gap-1">
                  {items.map((_, i) => {
                    const cell = a.items?.[String(i)];
                    if (!cell) return <span key={i} className="h-4 w-4 rounded-full border border-border" title={t('chatLive.live.noAnswer')} />;
                    return cell.correct
                      ? <CheckCircle2 key={i} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label={t('chatLive.live.right')} />
                      : <XCircle key={i} className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-label={t('chatLive.live.wrong')} />;
                  })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
