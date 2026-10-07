import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCheck, ChevronRight, Download, Loader2, MonitorCheck, RotateCcw, Search } from 'lucide-react';
import { lessonPath } from '../lib/lessonLinks';
import { cn } from '../lib/utils';
import {
  ISSUES,
  clearedByReview,
  clock,
  hasIssue,
  isMismatch,
  issueCounts,
  lessonHeadline,
  needsAttention,
  reportCsv,
  reviewedCount,
  rulesText,
  stillLoading,
  tallyByTeacher,
  verdictLine,
  withoutReviewed,
  type IssueKey,
} from '../lib/meetAttendance';
import { SearchableSelect } from '../components/ui/searchable-select';
import { FlagChip, lessonReviewing } from '../components/meetAttendance/FlagReview';
import MeetAttendanceDialog, { type MeetDialogTab } from '../components/meetAttendance/MeetAttendanceDialog';
import { MeetSyncBanner, MeetWaitingSummary, useNow } from '../components/meetAttendance/MeetSyncStatus';
import { TeacherTallyTable } from '../components/meetAttendance/TeacherTallyTable';
import { GroupTalkView } from '../components/meetAttendance/GroupTalkView';
import { TeacherTalkView } from '../components/meetAttendance/TeacherTalkView';
import { TalkSettingsButton } from '../components/meetAttendance/TalkSettingsButton';
import { RegisterSwitchButton } from '../components/meetAttendance/RegisterSwitchButton';
import { LiveSwitchButton } from '../components/meetAttendance/LiveSwitchButton';
import { RegisterReportPanel } from '../components/meetAttendance/RegisterReportPanel';
import { LessonRecordingCell, recordingMeta } from '../components/meetAttendance/LessonRecordingCell';
import RecordingPlayerDialog, { type RecordingMeta } from '../components/recordings/RecordingPlayerDialog';
import { useRecordingStatuses } from '../components/recordings/useRecordingStatuses';
import { liveEventIds } from '../lib/recordingProgress';
import { useLocale, useT } from '../lib/i18n/react';
import { formatDate, type MessageKey } from '../lib/i18n';
import { percent } from '../lib/meetTalk';
import {
  listMeetRecords,
  type MeetFlagCode,
  type MeetLessonFlag,
  type MeetLessonSummary,
  type MeetRecord,
  type MeetReviewOptions,
  type MeetSync,
  type MeetVerdictRules,
} from '../services/api/meetAttendance';
import { useAuth } from '../contexts/AuthContext';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

// 'waiting': the lessons not final yet, and nothing else — what the banner's «Show them» opens.
type Show = 'attention' | 'all' | 'waiting';
type Period = 7 | 30;
type View = 'lessons' | 'talk';
type TalkMode = 'group' | 'teacher';

// Every teacher side by side is for heads (owner, 2026-09-11); the backend says the same.
const TALK_BY_TEACHER = new Set(['admin', 'head_curator', 'head_teacher']);

const DAY = 24 * 60 * 60 * 1000;

function dayLabel(iso: string): string {
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

// Student timing is listed by name only where it is what the list is filtered by.
const LISTED_TIMING: Partial<Record<IssueKey, MeetFlagCode>> = { students_late: 'late', left_early: 'left_early' };

/** The student flags a row spells out: marks that disagree, and the timing being filtered by. */
function studentFlagsFor(item: MeetLessonSummary, issue: IssueKey | null): MeetLessonFlag[] {
  const timing = issue ? LISTED_TIMING[issue] : undefined;
  return item.flags.filter((f) => f.role !== 'teacher' && (isMismatch(f.code) || f.code === timing));
}

type Audience = 'heads' | 'teacher' | 'curator';

const INTRO: Record<Audience, MessageKey> = {
  heads: 'meetViews.review.introHeads',
  teacher: 'meetViews.review.introTeacher',
  curator: 'meetViews.review.introCurator',
};

const EMPTY: Record<Audience, MessageKey> = {
  heads: 'meetViews.review.emptyHeads',
  teacher: 'meetViews.review.emptyTeacher',
  curator: 'meetViews.review.emptyCurator',
};

/**
 * Lessons held in LMS Meet rooms, read against their marks: where the marks disagree with who
 * was in the room, accounts still to confirm, and teachers who started late or ended early.
 *
 * One page for everyone who may read the record; the backend decides which lessons each viewer
 * gets (heads: all; teachers: taught + own groups; curators: their groups). Teachers see their
 * own punctuality exactly as heads do — owner's decision, 2026-09-11.
 */
export default function MeetAttendanceReview() {
  const { user } = useAuth();
  const locale = useLocale();
  const t = useT();
  const audience: Audience = user?.role === 'teacher' ? 'teacher' : user?.role === 'curator' ? 'curator' : 'heads';
  const [items, setItems] = useState<MeetLessonSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(30);
  const [show, setShow] = useState<Show>('attention');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openTab, setOpenTab] = useState<MeetDialogTab>('attendance');
  const [playing, setPlaying] = useState<RecordingMeta | null>(null);
  const [view, setView] = useState<View>('lessons');
  const [talkEnabled, setTalkEnabled] = useState(false);
  const [talkMode, setTalkMode] = useState<TalkMode>('group');
  const [talkGroupId, setTalkGroupId] = useState<string | null>(null);
  const byTeacher = TALK_BY_TEACHER.has(user?.role ?? '');
  // Reviewed flags are out of the list until asked for (owner, 2026-09-11).
  const [showReviewed, setShowReviewed] = useState(false);
  const [registerRefresh, setRegisterRefresh] = useState(0);
  const [options, setOptions] = useState<MeetReviewOptions | undefined>(undefined);
  const [rules, setRules] = useState<MeetVerdictRules | undefined>(undefined);

  // What the check with Google Meet is doing, when the list was read, and whether a read is under way.
  const [sync, setSync] = useState<MeetSync | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  // `quiet` refreshes in place (after confirming accounts, and while lessons wait on Google Meet) instead of blanking the list.
  const load = useCallback((quiet = false) => {
    setError(false);
    if (!quiet) setItems(null);
    setRefreshing(true);
    listMeetRecords({ date_from: new Date(Date.now() - period * DAY).toISOString() })
      .then((r) => {
        setItems(r.items); setOptions(r.review_options); setRules(r.verdict_rules); setTalkEnabled(Boolean(r.talk_enabled));
        setSync(r.sync ?? null); setUpdatedAt(Date.now());
      })
      .catch(() => { if (!quiet) setError(true); })
      .finally(() => setRefreshing(false));
  }, [period]);
  useEffect(() => load(), [load]);

  // Lessons waiting on Google Meet fill in by themselves: the list is read again every minute while
  // the tab is in view, and straight away when it comes back into view.
  const waitingLessons = useMemo(() => (items ?? []).filter(stillLoading), [items]);
  const waitingCount = waitingLessons.length;
  const watching = waitingCount > 0 || Boolean(sync?.running);
  useEffect(() => {
    if (!watching) return;
    const visible = () => document.visibilityState === 'visible';
    const id = window.setInterval(() => { if (visible()) load(true); }, 60_000);
    const onVisible = () => { if (visible()) load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [watching, load]);

  // A review saved from the list returns the lesson's record: its row takes the new flags.
  const applyRecord = useCallback((record: MeetRecord) => {
    setItems((prev) => prev?.map((i) => (i.event_id !== record.event_id ? i : {
      ...i,
      flags: record.flags ?? [],
      mismatches: record.mismatches ?? 0,
      reviewed: record.reviewed ?? 0,
      unknown: record.unknown?.length ?? i.unknown,
      // A corrected mark changes what agrees with Meet and who is left unmarked.
      verdict_summary: record.verdict_summary ?? i.verdict_summary,
    })) ?? prev);
  }, []);
  const reviewingFor = useCallback(
    (eventId: number) => lessonReviewing(eventId, user?.role, options, applyRecord),
    [user?.role, options, applyRecord],
  );

  const teachers = useMemo(() => {
    const seen = new Map<number, string>();
    (items ?? []).forEach((i) => { if (i.teacher) seen.set(i.teacher.id, i.teacher.name); });
    return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => byName({ name: a.label }, { name: b.label }));
  }, [items]);
  const groups = useMemo(() => {
    const seen = new Map<number, string>();
    (items ?? []).forEach((i) => i.groups.forEach((g) => seen.set(g.id, g.name)));
    return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => byName({ name: a.label }, { name: b.label }));
  }, [items]);

  // Group and search narrow everything, the by-teacher summary included; the teacher filter and
  // the issue narrow the list below it (the summary is how you pick those).
  const base = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter((i) => {
      if (groupId && !i.groups.some((g) => String(g.id) === groupId)) return false;
      const hay = `${i.title} ${i.teacher?.name ?? ''} ${i.groups.map((g) => g.name).join(' ')} ${i.flags.map((f) => f.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, groupId, query]);
  const scoped = useMemo(
    () => (teacherId ? base.filter((i) => String(i.teacher?.id) === teacherId) : base),
    [base, teacherId],
  );
  // Everything below reads the lessons without their reviewed flags, unless «Show reviewed» is on.
  const listed = useMemo(() => (showReviewed ? scoped : scoped.map(withoutReviewed)), [scoped, showReviewed]);
  const tally = useMemo(() => tallyByTeacher(showReviewed ? base : base.map(withoutReviewed)), [base, showReviewed]);
  const counts = useMemo(() => issueCounts(listed), [listed]);
  const reviewedTotal = useMemo(() => reviewedCount(scoped), [scoped]);
  const inAttention = useCallback(
    (i: MeetLessonSummary) => needsAttention(i) || (showReviewed && clearedByReview(i)),
    [showReviewed],
  );
  const attentionCount = listed.filter(inAttention).length;
  // An issue picked is its own view; otherwise "needs attention" or everything.
  const visible = useMemo(() => listed.filter((i) => (
    issue ? hasIssue(i, issue) : show === 'waiting' ? stillLoading(i) : show === 'all' || inAttention(i)
  )), [listed, issue, show, inAttention]);
  // Recordings still on their way in the rows on screen: one batched status poll, never one per row.
  const liveIds = useMemo(() => liveEventIds(visible.flatMap((i) => (
    i.recording ? [{ event_id: i.event_id, status: i.recording.status }] : []
  ))), [visible]);
  const liveRecordings = useRecordingStatuses(liveIds, view === 'lessons');

  const filtered = Boolean(teacherId || groupId || query || issue);
  // Talk time is a filter only where some lesson has it; otherwise the chip would sit there greyed out forever.
  const anyTalk = useMemo(() => (items ?? []).some((i) => i.talk), [items]);
  const openLesson = (eventId: number, tab: MeetDialogTab) => { setOpenTab(tab); setOpenId(eventId); };

  const exportCsv = () => {
    const blob = new Blob([reportCsv(visible)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    link.download = `meet-attendance_${period}d_${today}${issue ? `_${issue}` : ''}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 @lg:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <MonitorCheck className="h-7 w-7 text-primary" aria-hidden />
            {t('meetViews.review.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t(INTRO[audience])} {t('meetViews.review.introHow')}
          </p>
          {rules && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {rulesText(rules)} {t('meetViews.review.rulesHow')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <TalkSettingsButton role={user?.role} onChanged={(next) => { setTalkEnabled(next.enabled); load(true); }} />
        <RegisterSwitchButton role={user?.role} onChanged={() => { setRegisterRefresh((n) => n + 1); load(true); }} />
        <LiveSwitchButton role={user?.role} />
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('meetViews.review.period')}>
          {([7, 30] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {t('meetViews.shared.lastDays', { count: p })}
            </button>
          ))}
        </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label={t('meetViews.review.view')}>
        {([['lessons', 'meetViews.shared.lessons'], ['talk', 'meet.talkCard.title']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
              view === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {view === 'talk' && (
        items === null ? (
          error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">{t('meetViews.review.loadFailed')}</p>
              <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <RotateCcw className="h-4 w-4" /> {t('common.retry')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('meetViews.review.loading')}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {byTeacher && (
              <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('meetViews.review.talkBy')}>
                {([['group', 'meetViews.review.byGroup'], ['teacher', 'meetViews.shared.byTeacher']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={talkMode === key}
                    onClick={() => setTalkMode(key)}
                    className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                      talkMode === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            )}
            {byTeacher && talkMode === 'teacher' ? (
              <TeacherTalkView
                periodDays={period}
                onOpenLesson={(eventId) => openLesson(eventId, 'talk')}
                onOpenGroup={(id) => { setTalkGroupId(String(id)); setTalkMode('group'); }}
              />
            ) : (
              <GroupTalkView
                groups={groups}
                periodDays={period}
                groupId={talkGroupId ?? groupId}
                onGroupChange={setTalkGroupId}
                talkEnabled={talkEnabled}
                onOpenLesson={(eventId) => openLesson(eventId, 'talk')}
              />
            )}
          </div>
        )
      )}

      {view === 'lessons' && (<>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('meetViews.review.show')}>
          {([['attention', 'meetViews.review.needsAttention', attentionCount], ['all', 'meetViews.review.allLessons', scoped.length]] as const).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              aria-pressed={!issue && show === key}
              onClick={() => { setShow(key); setIssue(null); }}
              className={cn('rounded-md px-2.5 py-1 text-[13px] font-medium transition',
                !issue && show === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {t(label)} <span className="tabular-nums text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
        {(reviewedTotal > 0 || showReviewed) && (
          <button
            type="button"
            aria-pressed={showReviewed}
            onClick={() => setShowReviewed((v) => !v)}
            title={t('meetViews.review.reviewedHint')}
            className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition',
              showReviewed
                ? 'border-slate-400 bg-muted text-foreground dark:border-border'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            {t(showReviewed ? 'meetViews.review.showingReviewed' : 'meetViews.review.showReviewed')}
            <span className="tabular-nums opacity-70">{reviewedTotal}</span>
          </button>
        )}
        <div className="relative w-full @lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="meet-attendance-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('meetViews.review.search')}
            aria-label={t('meetViews.review.search')}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {/* A teacher's own list usually has one teacher in it; the filter only earns its place
            when substitutes covered some of their groups' lessons. */}
        {teachers.length > 1 && (
          <SearchableSelect options={teachers} value={teacherId} onChange={setTeacherId} placeholder={t('meetViews.shared.allTeachers')}
            searchPlaceholder={t('meetViews.review.searchTeachers')} emptyText={t('meetViews.review.noTeacherMatches')} className="h-9 w-48 text-sm" />
        )}
        <SearchableSelect options={groups} value={groupId} onChange={setGroupId} placeholder={t('meetViews.review.allGroups')}
          searchPlaceholder={t('meetViews.shared.searchGroups')} emptyText={t('meetViews.shared.noGroupMatches')} className="h-9 w-56 text-sm" />
        {filtered && (
          <button
            type="button"
            onClick={() => { setTeacherId(null); setGroupId(null); setQuery(''); setIssue(null); if (show === 'waiting') setShow('all'); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t('meetViews.review.clear')}
          </button>
        )}
      </div>

      {items !== null && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('meetViews.review.filterByIssue')}>
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('meetViews.review.issue')}</span>
          {ISSUES.filter(({ key }) => key !== 'silent_students' || anyTalk).map(({ key, label, hint }) => {
            const active = issue === key;
            const none = counts[key] === 0;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                title={hint}
                disabled={none && !active}
                onClick={() => setIssue(active ? null : key)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                  none && !active && 'cursor-default opacity-40 hover:bg-card',
                )}
              >
                {label} <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>{counts[key]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            title={t('meetViews.review.exportHint')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> {t('meetViews.shared.exportCsv')}
          </button>
        </div>
      )}

      {items !== null && (
        <MeetSyncBanner
          sync={sync}
          waiting={waitingLessons.map((i) => i.waiting)}
          updatedAt={updatedAt}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          onShowWaiting={show !== 'waiting' || issue ? () => { setIssue(null); setShow('waiting'); } : undefined}
          onShowAll={show === 'waiting' && !issue ? () => setShow('all') : undefined}
        />
      )}

      {items !== null && <RegisterReportPanel refreshKey={registerRefresh} />}

      {audience !== 'teacher' && items !== null && (
        <TeacherTallyTable
          rows={tally}
          onPick={(id, pick) => { setTeacherId(String(id)); setIssue(pick); if (!pick) setShow('all'); }}
        />
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t('meetViews.review.loadFailed')}</p>
          <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <RotateCcw className="h-4 w-4" /> {t('common.retry')}
          </button>
        </div>
      )}

      {!error && items === null && (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('meetViews.review.loading')}
        </div>
      )}

      {!error && items !== null && (
        visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? t(EMPTY[audience], { count: period })
              : show === 'attention' && !filtered
                ? reviewedTotal > 0 && !showReviewed
                  ? t('meetViews.review.nothingHidden', { count: reviewedTotal })
                  : t('meetViews.review.nothing')
                : issue
                  ? t('meetViews.review.noIssue', { issue: ISSUES.find((i) => i.key === issue)?.label ?? '' })
                  : show === 'waiting'
                    ? t('meetViews.review.allFinal')
                    : t('meetViews.review.noMatch')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">{t('meet.dialog.lesson')}</th>
                  <th className="px-4 py-2.5">{t('meetViews.review.teacherInRoom')}</th>
                  <th className="px-4 py-2.5 text-right">{t('meet.talkPanel.students')}</th>
                  <th className="px-4 py-2.5">{t('meetViews.review.standsOut')}</th>
                  <th className="px-4 py-2.5">{t('meetViews.review.recording')}</th>
                  <th className="w-10 px-2 py-2.5" aria-label={t('meetViews.shared.open')} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((item) => {
                  const teacherFlags = item.flags.filter((f) => f.role === 'teacher');
                  const studentFlags = studentFlagsFor(item, issue);
                  const reviewing = reviewingFor(item.event_id);
                  const live = liveRecordings[String(item.event_id)];
                  return (
                    <tr
                      key={item.event_id}
                      onClick={() => openLesson(item.event_id, 'attendance')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLesson(item.event_id, 'attendance'); } }}
                      tabIndex={0}
                      aria-label={t('meetViews.shared.openNamed', { name: item.title })}
                      className="cursor-pointer align-top transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {dayLabel(item.start)} · {clock(item.start)}–{clock(item.end)}
                        </div>
                        {/* The row opens the Meet dialog; the lesson's own page is one click away. */}
                        <Link
                          to={lessonPath(item.event_id)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {t('meet.dialog.openLesson')} <ArrowUpRight className="h-3 w-3" aria-hidden />
                        </Link>
                      </td>
                      {stillLoading(item) ? (
                        <td colSpan={3} className="px-4 py-3">
                          <MeetWaitingSummary waiting={item.waiting} now={now} />
                        </td>
                      ) : (<>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{item.teacher?.name ?? '—'}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {item.teacher?.first_join
                              ? `${clock(item.teacher.first_join)} → ${clock(item.teacher.last_leave)}`
                              : t(item.held_back ? 'meetViews.review.accountNotConfirmed' : 'meet.participants.notInRoom')}
                          </div>
                          {teacherFlags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {teacherFlags.map((f) => (
                                <FlagChip key={f.code} flag={f} userId={f.user_id} personName={f.name} reviewing={reviewing} />
                              ))}
                            </div>
                          )}
                          {item.talk?.teacher_share != null && (
                            <div className="mt-1.5 flex items-center gap-2" title={t('meetViews.review.teacherShareHint')}>
                              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <span className="block h-full rounded-full bg-violet-500 dark:bg-violet-400"
                                  style={{ width: `${Math.min(100, item.talk.teacher_share * 100)}%` }} />
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {t('meetViews.review.teacherTalk', { share: percent(item.talk.teacher_share) })}
                                {item.talk.silent.length > 0 && ` · ${t('meet.talk.silentCount', { count: item.talk.silent.length })}`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="font-semibold text-foreground">{item.joined}</span>
                          <span className="text-muted-foreground"> / {item.students}</span>
                          {item.unknown > 0 && (
                            <div className="text-xs text-amber-700 dark:text-amber-300">{t('meetViews.review.unconfirmed', { count: item.unknown })}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn('text-[13px]', needsAttention(item) ? 'text-foreground' : 'text-muted-foreground')}>
                            {lessonHeadline(item)}
                          </div>
                          {verdictLine(item.verdict_summary) && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{verdictLine(item.verdict_summary)}</div>
                          )}
                          {studentFlags.length > 0 && (
                            <ul className="mt-1.5 space-y-1 text-xs">
                              {studentFlags.slice(0, 6).map((f) => (
                                <li key={`${f.user_id}-${f.code}`} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="text-foreground">{f.name}</span>
                                  <FlagChip flag={f} userId={f.user_id} personName={f.name} reviewing={reviewing}
                                    lateToo={item.flags.some((g) => g.user_id === f.user_id && g.code === 'late')} />
                                </li>
                              ))}
                              {studentFlags.length > 6 && (
                                <li className="text-muted-foreground">{t('meetViews.review.more', { count: studentFlags.length - 6 })}</li>
                              )}
                            </ul>
                          )}
                        </td>
                      </>)}
                      <td className="px-4 py-3">
                        {item.recording && (
                          <LessonRecordingCell
                            status={live?.status ?? item.recording.status}
                            durationSeconds={live?.duration_seconds ?? item.recording.duration_seconds}
                            progress={live?.progress}
                            onWatch={() => setPlaying(recordingMeta(item, live?.duration_seconds))}
                          />
                        )}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      </>)}

      <MeetAttendanceDialog
        eventId={openId}
        initialTab={openTab}
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenId(null);
            load(true); // confirmations inside change this list
          }
        }}
      />
      <RecordingPlayerDialog
        meta={playing}
        open={playing !== null}
        onOpenChange={(open) => { if (!open) setPlaying(null); }}
        locale={locale}
      />
    </div>
  );
}
