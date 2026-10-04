import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LiveAvatar } from './orcas';
import { activityLabel, correctIndices, optionLabel } from '../../lib/liveLesson/logic';
import type { ActivityView, NamedAnswer } from '../../lib/liveLesson/types';
import { CloudView, OptionRows, QuestionBody } from './parts';

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
  const [showNames, setShowNames] = useState(false);
  const named = names && !activity.anonymous && activity.answers;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{activityLabel(activity.kind)}</span>
        {activity.anonymous && <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" aria-hidden />anonymous</span>}
        <span>{activity.answered} answered{activity.offered ? ` of ${Math.max(activity.offered, activity.answered)} here` : ''}</span>
        <span className={cn('rounded-full px-1.5 py-px font-semibold', activity.status === 'open'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          : activity.revealed ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-muted text-muted-foreground')}>
          {activity.status === 'open' ? 'open' : activity.revealed ? 'shown' : 'closed'}
        </span>
      </div>
      {activity.prompt && <p className="text-sm font-semibold text-foreground">{activity.prompt}</p>}
      <Body activity={activity} onHide={onHide} names={names} />
      {named && activity.kind !== 'popcheck' && activity.kind !== 'cloud' && (
        <div>
          <button type="button" onClick={() => setShowNames((v) => !v)} className="text-xs font-semibold text-primary">
            {showNames ? 'Hide who answered what' : 'Who answered what'}
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
  if (!answers.length) return <p className="mt-1 text-xs text-muted-foreground">Nobody yet.</p>;
  return (
    <ul className="mt-1 divide-y divide-border rounded-lg border border-border text-xs">
      {[...answers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map((a) => (
        <li key={a.user_id} className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="flex min-w-0 items-center gap-1.5"><LiveAvatar person={a} size={20} /><span className="truncate text-foreground">{a.name}</span></span>
          <span className={cn('flex-none', a.correct === true && 'text-emerald-700 dark:text-emerald-400', a.correct === false && 'text-rose-600')}>
            {optionText(activity, a.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Body({ activity, onHide, names }: { activity: ActivityView; onHide?: (id: number, hidden: boolean) => void; names: boolean }) {
  if (activity.kind === 'poll') {
    return <OptionRows options={activity.options ?? []} counts={activity.results?.counts ?? []} />;
  }
  if (activity.kind === 'mistake' && activity.question) {
    return (
      <div className="space-y-2 text-sm">
        {activity.stats && (
          <p className="text-xs text-muted-foreground">
            In the homework {Math.round(activity.stats.share_wrong * 100)}% got it wrong ({activity.stats.wrong} of {activity.stats.answered})
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
              Entries ({entries.length}){entries.some((e) => e.hidden) ? ` · ${entries.filter((e) => e.hidden).length} hidden` : ''}
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
                      <span className="ml-1.5 text-amber-700 dark:text-amber-400">{e.hidden === 'ai' ? '(hidden by AI check)' : '(filtered)'}</span>
                    )}
                  </span>
                  {onHide && (
                    <button type="button" onClick={() => onHide(e.id, !e.hidden)}
                      className="inline-flex flex-none items-center gap-1 font-semibold text-primary">
                      {e.hidden ? <><RotateCcw className="h-3 w-3" aria-hidden />Restore</> : <><Eye className="h-3 w-3" aria-hidden />Hide</>}
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
            <span>Question {i + 1}</span>
            {item.answered != null && <span>{item.right} of {item.answered} right</span>}
          </div>
          <QuestionBody question={item.question} />
          {item.question.options ? (
            <div className="mt-1.5"><OptionRows options={item.question.options} rich correct={correctIndices(item.key?.correct)} /></div>
          ) : item.key && (
            <p className="mt-1 text-xs">Right answer: <b>{(item.key.correct as string[]).join(' or ')}</b></p>
          )}
        </div>
      ))}
      {names && activity.answers && activity.answers.length > 0 && (
        <details className="rounded-lg border border-border text-xs">
          <summary className="cursor-pointer px-2 py-1.5 font-semibold text-foreground">Each student</summary>
          <ul className="divide-y divide-border">
            {activity.answers.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="flex min-w-0 items-center gap-1.5"><LiveAvatar person={a} size={20} /><span className="truncate">{a.name}</span></span>
                <span className="flex flex-none gap-1">
                  {items.map((_, i) => {
                    const cell = a.items?.[String(i)];
                    if (!cell) return <span key={i} className="h-4 w-4 rounded-full border border-border" title="No answer" />;
                    return cell.correct
                      ? <CheckCircle2 key={i} className="h-4 w-4 text-emerald-600" aria-label="Right" />
                      : <XCircle key={i} className="h-4 w-4 text-rose-600" aria-label="Wrong" />;
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
