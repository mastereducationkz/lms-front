import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { groupTalkCsv, lessonPeakSeconds, marksSummary, percent, sortGroupStudents, spokeInText, type GroupStudentSort } from '../../lib/meetTalk';
import { getGroupTalk, TalkSwitchedOff, type GroupTalk } from '../../services/api/meetTalk';
import { SearchableSelect, type SearchableOption } from '../ui/searchable-select';
import {
  Card,
  DotsLegend,
  LessonBars,
  QuestionCards,
  ShareBar,
  SortHeader,
  SplitCard,
  TalkLessonsTable,
  nextSort,
  spokeFor,
} from './TalkReportParts';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

const DAY = 24 * 60 * 60 * 1000;

interface Props {
  /** The groups the viewer's lessons belong to. */
  groups: SearchableOption[];
  periodDays: number;
  /** The group shown; the page keeps it so «By teacher» can open a group here. */
  groupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  /** The admin switch; while off (and nothing saved), the view says so. */
  talkEnabled: boolean;
  /** Open one lesson's talk time. */
  onOpenLesson: (eventId: number) => void;
}

const COLUMNS: { key: GroupStudentSort; label: MessageKey; hint?: MessageKey; left?: boolean }[] = [
  { key: 'name', label: 'meet.participants.student', left: true },
  { key: 'lessons_spoke', label: 'meetViews.shared.lessons', hint: 'meetViews.groupTalk.lessonsHint', left: true },
  { key: 'total_seconds', label: 'meetViews.groupTalk.total' },
  { key: 'avg_seconds', label: 'meetViews.groupTalk.avg', hint: 'meetViews.groupTalk.avgHint' },
  { key: 'share_of_student_talk', label: 'meetViews.groupTalk.share', hint: 'meetViews.groupTalk.shareHint' },
  { key: 'questions', label: 'meetViews.groupTalk.asked', hint: 'meetViews.groupTalk.askedHint' },
  { key: 'answers', label: 'meetViews.groupTalk.answered', hint: 'meetViews.groupTalk.answeredHint' },
];

/**
 * One group's talk time over the period: who speaks in its lessons and who doesn't, lesson by
 * lesson; how much of the talking is the teacher's; and the questions — the teacher's, how many
 * a student answered, and the students' own.
 */
export function GroupTalkView({ groups, periodDays, groupId, onGroupChange, talkEnabled, onOpenLesson }: Props) {
  const t = useT();
  const [data, setData] = useState<GroupTalk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'off' | 'failed' | null>(null);
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{ key: GroupStudentSort; direction: 'asc' | 'desc' }>({ key: 'total_seconds', direction: 'desc' });

  // One group only: nothing to choose.
  useEffect(() => {
    if (!groupId && groups.length === 1) onGroupChange(groups[0].value);
  }, [groupId, groups, onGroupChange]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    getGroupTalk(Number(groupId), { date_from: new Date(Date.now() - periodDays * DAY).toISOString() })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof TalkSwitchedOff ? 'off' : 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId, periodDays, retry]);

  const students = useMemo(() => (data ? sortGroupStudents(data.students, sort.key, sort.direction) : []), [data, sort]);
  // One scale for every row's sparkline: the group's longest speech in a single lesson.
  const peak = useMemo(() => lessonPeakSeconds(data?.students ?? []), [data]);
  const onSort = (key: GroupStudentSort) => setSort((s) => nextSort(s, key, ['name']));

  const silentTimes = students.reduce((n, s) => n + s.silent_lessons, 0);
  const silentStudents = students.filter((s) => s.silent_lessons > 0).length;
  const voices = data?.lessons.filter((l) => l.source === 'voices').length ?? 0;

  const exportCsv = () => {
    if (!data) return;
    const blob = new Blob([groupTalkCsv(data)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safe = data.group.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    link.download = `talk-time_${safe}_${periodDays}d_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchableSelect options={groups} value={groupId} onChange={onGroupChange} placeholder={t('meetViews.groupTalk.chooseGroup')}
          searchPlaceholder={t('meetViews.shared.searchGroups')} emptyText={t('meetViews.shared.noGroupMatches')} className="h-9 w-64 text-sm" />
        <span className="text-xs text-muted-foreground">
          {[
            t('meetViews.shared.lastDays', { count: periodDays }),
            data ? t('common.lessons', { count: data.totals.lessons }) : null,
            t('meetViews.shared.timesAlmaty'),
          ].filter(Boolean).join(' · ')}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data || data.lessons.length === 0}
          title={t('meetViews.groupTalk.exportHint')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> {t('meetViews.shared.exportCsv')}
        </button>
      </div>

      {!groupId && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          {t(groups.length === 0 ? 'meetViews.groupTalk.noGroups' : 'meetViews.groupTalk.chooseHint')}
        </div>
      )}

      {groupId && loading && (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('meet.dialog.loadingTalk')}
        </div>
      )}

      {groupId && error === 'off' && (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          {t('meet.talkPanel.stateOff')}
        </p>
      )}

      {groupId && error === 'failed' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t('meetViews.groupTalk.failed')}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <RotateCcw className="h-4 w-4" /> {t('common.retry')}
          </button>
        </div>
      )}

      {groupId && !loading && !error && data === null && (
        <p className="px-1 py-6 text-sm text-muted-foreground">{t('meetViews.groupTalk.unavailable')}</p>
      )}

      {data && data.lessons.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          {talkEnabled
            ? t('meetViews.groupTalk.empty', { group: data.group.name, count: periodDays })
            : t('meetViews.groupTalk.offEmpty')}
        </div>
      )}

      {data && data.lessons.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-5">
            <SplitCard
              className="sm:col-span-2"
              teacherSeconds={data.totals.teacher_seconds}
              studentSeconds={data.totals.student_seconds}
              teacherShare={data.teacher.avg_share}
              studentsShare={data.teacher.avg_share == null ? null : 1 - data.teacher.avg_share}
              note={`${t('common.lessons', { count: data.totals.lessons })}${voices ? ` · ${t('meetViews.groupTalk.namedByVoice', { count: voices })}` : ''}`}
            />
            <QuestionCards questions={data.questions} lessons={data.totals.lessons} />
            <Card
              label={t('meet.talkPanel.didntSpeak')}
              hint={t('meetViews.groupTalk.silentHint')}
              value={silentTimes ? t('meetViews.groupTalk.silentTimes', { count: silentTimes }) : t('meetViews.groupTalk.nobody')}
              tone={silentTimes ? 'warn' : undefined}
              sub={silentTimes
                ? t('meetViews.groupTalk.silentStudents', { silent: silentStudents, count: students.length })
                : t('meetViews.groupTalk.everyoneSpoke')}
            />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label={t('meet.talkPanel.students')}>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {COLUMNS.map((c) => (
                    <SortHeader key={c.key} label={t(c.label)} hint={c.hint && t(c.hint)} column={c.key} sort={sort} onSort={onSort}
                      align={c.left ? 'left' : 'right'} className={c.key === 'name' ? 'pl-4' : undefined} />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => {
                  const marks = s.lessons ?? [];
                  const neverSpoke = s.lessons_spoke === 0 && s.lessons_in_room > 0;
                  const neverThere = s.lessons_in_room === 0;
                  return (
                    <tr key={s.user_id} className={cn(neverSpoke && 'bg-amber-50/50 dark:bg-amber-950/10')}>
                      <td className="py-2 pl-4 pr-3">
                        <span className="font-medium text-foreground">{s.name}</span>
                        {neverSpoke && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t('meetViews.groupTalk.silent')}
                          </span>
                        )}
                        {neverThere && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('meet.participants.notInRoom')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2" title={marks.length ? marksSummary(marks) : undefined}>
                        {marks.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <LessonBars marks={marks} peakSeconds={peak} />
                            <span className="text-[11px] text-muted-foreground">{spokeInText(marks)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('meet.talk.spokeIn', { spoke: s.lessons_spoke, total: s.lessons_in_room })}</span>
                        )}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', s.total_seconds ? 'font-semibold text-foreground' : 'text-muted-foreground/60')}>
                        {spokeFor(s.total_seconds)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{spokeFor(s.avg_seconds)}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {s.total_seconds ? <ShareBar share={s.share_of_student_talk} tone="student" /> : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.questions ? s.questions : <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.answers ? s.answers : <span className="text-muted-foreground/60">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <DotsLegend />
          {data.questions == null && (
            <p className="px-1 text-[11px] text-muted-foreground">
              {t('meetViews.groupTalk.needTranscripts')}
            </p>
          )}

          <TalkLessonsTable lessons={data.lessons} onOpenLesson={onOpenLesson} show="teacher" />
          <p className="px-1 text-[11px] text-muted-foreground">
            {t('meetViews.groupTalk.footnote', { share: percent(data.teacher.avg_share) })}
          </p>
        </>
      )}
    </div>
  );
}
