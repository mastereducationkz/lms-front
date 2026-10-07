import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../services/api';
import type { LessonRequest, CancelResolution } from '../../types';
import { formatDateTime, type MessageKey, type TFunction } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import TeacherRescheduleStatsPanel from './TeacherRescheduleStatsPanel';

type Props = {
  variant?: 'admin' | 'head_teacher';
};

/** «Head teacher» is not a job title anybody here uses. */
const APPROVER_ROLE_LABELS: Record<string, MessageKey> = {
  head_teacher: 'lessonRequests.role.headTeacher',
  teacher: 'lessonRequests.role.teacher',
  admin: 'lessonRequests.role.admin',
  head_curator: 'lessonRequests.role.headCurator',
  curator: 'lessonRequests.role.curator',
};

const TYPE_LABELS: Record<string, MessageKey> = {
  substitution: 'lessonRequests.type.substitution',
  reschedule: 'lessonRequests.type.reschedule',
  cancel: 'lessonRequests.type.cancel',
};

const STATUS_LABELS: Record<string, MessageKey> = {
  approved: 'lessonRequests.status.approved',
  rejected: 'lessonRequests.status.rejected',
  pending_teacher: 'lessonRequests.status.pendingTeacher',
  pending: 'lessonRequests.status.pending',
};

/** The two ways an approved cancel can go. The approver has to pick one — there is no
 *  default on this page, because «the lesson just disappears» and «one more lesson at the
 *  end of the course» are decisions about the group's plan, not about this request. */
const CANCEL_RESOLUTION_OPTIONS: { value: CancelResolution; label: MessageKey; hint: MessageKey }[] = [
  {
    value: 'cancel_only',
    label: 'lessonRequests.cancel.cancelOnly',
    hint: 'lessonRequests.cancel.cancelOnlyHint',
  },
  {
    value: 'add_replacement',
    label: 'lessonRequests.cancel.addReplacement',
    hint: 'lessonRequests.cancel.addReplacementHint',
  },
];

const cancelResolutionLabel = (t: TFunction, value?: string | null) => {
  if (!value) return null;
  const option = CANCEL_RESOLUTION_OPTIONS.find(o => o.value === value);
  return option ? t(option.label) : value;
};

const roleLabel = (t: TFunction, role?: string | null) =>
  role ? (APPROVER_ROLE_LABELS[role] ? t(APPROVER_ROLE_LABELS[role]) : role) : null;

const typeLabel = (t: TFunction, type: string) => (TYPE_LABELS[type] ? t(TYPE_LABELS[type]) : type);

const statusLabel = (t: TFunction, status: string) => (STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status);

/** Exact Almaty date and time. The list used to print only a short date, so two requests for
 *  the same day were indistinguishable and "19:00" — the thing being argued about — was
 *  nowhere on the page. */
const formatExact = (value?: string | null) =>
  value
    ? formatDateTime(value, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** A translated sentence with its {placeholders} shown in bold. */
function withBoldParams(template: string, values: Record<string, React.ReactNode>) {
  return template.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <strong key={i}>{values[part]}</strong> : part));
}

/** One labelled fact in the detail panel. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children ?? '—'}</dd>
    </div>
  );
}

/** What happened to this request, in order.
 *
 * The list showed a status and a pair of names; it could not answer "when was this decided,
 * and did anything happen afterwards". */
function Timeline({ req }: { req: LessonRequest }) {
  const t = useT();
  const steps: { at?: string | null; title: string; detail?: string | null; alert?: boolean }[] = [
    {
      at: req.created_at,
      title: t('lessonRequests.timeline.created'),
      detail: req.requester_name ? `${req.requester_name}` : null,
    },
  ];

  if (req.confirmed_teacher_name) {
    steps.push({ at: null, title: t('lessonRequests.timeline.substituteChosen'), detail: req.confirmed_teacher_name });
  }

  if (req.status === 'approved' || req.status === 'rejected') {
    const who = [req.resolver_name, roleLabel(t, req.resolver_role)].filter(Boolean).join(', ');
    steps.push({
      at: req.resolved_at,
      title: t(req.status === 'approved' ? 'lessonRequests.status.approved' : 'lessonRequests.status.rejected'),
      detail: who || null,
    });
  }

  if (req.status === 'approved' && req.is_applied === true) {
    steps.push({
      at: null,
      title: t('lessonRequests.timeline.applied'),
      detail: req.current_event_teacher_name
        ? t('lessonRequests.timeline.taughtBy', { name: req.current_event_teacher_name })
        : null,
    });
  }

  if (req.status === 'approved' && req.is_applied === false) {
    steps.push({
      at: null,
      title: t('lessonRequests.timeline.notApplied'),
      detail: req.current_event_teacher_name
        ? t('lessonRequests.timeline.scheduledWith', { name: req.current_event_teacher_name })
        : null,
      alert: true,
    });
  }

  if (req.attendance_marked) {
    steps.push({ at: null, title: t('lessonRequests.timeline.attendanceMarked') });
  }

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              s.alert ? 'bg-red-500' : 'bg-muted-foreground/40'
            }`}
          />
          <div className="min-w-0">
            <span className="font-medium">{s.title}</span>
            {s.detail && <span className="text-muted-foreground"> — {s.detail}</span>}
            {s.at && (
              <span className="block text-xs text-muted-foreground">{formatExact(s.at)}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function LessonRequestManagement({ variant = 'admin' }: Props) {
  const t = useT();
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState<Record<number, string>>({});
  // The approver's choice per pending cancel request; seeded from the teacher's proposal.
  const [cancelChoice, setCancelChoice] = useState<Record<number, CancelResolution>>({});
  const [processing, setProcessing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const isHeadTeacher = variant === 'head_teacher';

  // Filters live in the URL so a link to "the rejected ones in August" is shareable and
  // survives a reload — the previous state was component-local and lost on both.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? 'pending,pending_teacher';
  const dateFrom = searchParams.get('from') ?? '';
  const dateTo = searchParams.get('to') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      let data: LessonRequest[];
      if (isHeadTeacher && statusFilter === 'pending,pending_teacher') {
        data = await apiClient.getPendingLessonRequests();
      } else {
        data = await apiClient.getLessonRequests(statusFilter || undefined);
      }
      setRequests(data);
      // Pre-select what the teacher proposed, without overriding a choice already made here.
      setCancelChoice(prev => {
        const next = { ...prev };
        for (const req of data) {
          if (
            req.request_type === 'cancel' &&
            req.status === 'pending' &&
            req.cancel_resolution &&
            !next[req.id]
          ) {
            next[req.id] = req.cancel_resolution;
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to fetch lesson requests:', err);
      setError(t('lessonRequests.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, variant]);

  /** A pending cancel needs a choice before it can be approved — the button stays disabled
   *  until one is made, and this guards the same line in case it is reached another way. */
  const needsCancelChoice = (req: LessonRequest) =>
    req.request_type === 'cancel' && !cancelChoice[req.id];

  /** The server's own message, when it sent one. A refused approval says what to do instead
   *  — «…выберите «только отменить»» when no free slot exists for the added lesson — and a
   *  generic banner would hide the one instruction that unblocks the head teacher. */
  const serverDetail = (err: any): string | null => {
    const detail = err?.response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  };

  const handleApprove = async (req: LessonRequest) => {
    if (needsCancelChoice(req)) return;
    const id = req.id;
    try {
      setProcessing(id);
      await apiClient.approveLessonRequest(
        id,
        adminComment[id],
        req.request_type === 'cancel' ? cancelChoice[id] : undefined,
      );
      await fetchRequests();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError(serverDetail(err) ?? t('lessonRequests.error.approve'));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setProcessing(id);
      await apiClient.rejectLessonRequest(id, adminComment[id]);
      await fetchRequests();
    } catch (err) {
      console.error('Failed to reject:', err);
      setError(t('lessonRequests.error.reject'));
    } finally {
      setProcessing(null);
    }
  };

  // Date filtering is client-side over the already-fetched page, matching how the status
  // filter behaved before; the bound is the lesson's own date, which is what a manager
  // means by "requests for last week".
  const visible = useMemo(() => {
    return requests.filter(req => {
      if (!dateFrom && !dateTo) return true;
      const day = (req.original_datetime || '').slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [requests, dateFrom, dateTo]);

  /** An approved request the schedule disagrees with. Staff see the ids; a teacher sees the
   *  sentence the server wrote, never an internal error. */
  const inconsistent = (req: LessonRequest) =>
    req.status === 'approved' && req.is_applied === false;

  const statusBadge = (status: string) => {
    const label = statusLabel(t, status);
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40 dark:border-green-800/60">{label}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{label}</Badge>;
      case 'pending_teacher':
        return <Badge className="bg-brand-subtle text-brand-subtle-foreground hover:bg-brand-subtle border-brand-border">{label}</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:border-amber-800/60">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  const inconsistentCount = visible.filter(inconsistent).length;

  const activeTab = searchParams.get('tab') === 'stats' ? 'stats' : 'requests';

  return (
    <div className="space-y-6">
      <div className="flex rounded-md shadow-sm w-fit">
        {([
          ['requests', t('lessonRequests.tabs.requests')],
          ['stats', t('lessonRequests.tabs.stats')],
        ] as [string, string][]).map(([value, label], idx, arr) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              onClick={() => setParam('tab', value)}
              className={`px-4 py-2 text-sm font-medium border transition-colors
                ${idx === 0 ? 'rounded-l-md' : ''}
                ${idx === arr.length - 1 ? 'rounded-r-md' : ''}
                ${idx !== 0 ? '-ml-px' : ''}
                ${isActive
                  ? 'bg-primary text-primary-foreground border-primary z-10'
                  : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'stats' ? (
        <TeacherRescheduleStatsPanel />
      ) : (
      <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('lessonRequests.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {isHeadTeacher
              ? t('lessonRequests.subtitle.headTeacher')
              : t('lessonRequests.subtitle.admin')}
          </p>
        </div>
        <div className="flex rounded-md shadow-sm">
          {([
            ['pending,pending_teacher', t('lessonRequests.filter.pending')],
            ['approved', t('lessonRequests.filter.approved')],
            ['rejected', t('lessonRequests.filter.rejected')],
            ...(isHeadTeacher ? [] : [['', t('common.all')] as [string, string]]),
          ] as [string, string][]).map(([value, label], idx, arr) => {
            const isActive = statusFilter === value;
            return (
              <button
                key={value || 'all'}
                onClick={() => setParam('status', value)}
                className={`px-4 py-2 text-sm font-medium border transition-colors
                  ${idx === 0 ? 'rounded-l-md' : ''}
                  ${idx === arr.length - 1 ? 'rounded-r-md' : ''}
                  ${idx !== 0 ? '-ml-px' : ''}
                  ${isActive
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('lessonRequests.filter.dateFrom')}
          <Input
            type="date"
            className="h-9 w-[160px]"
            value={dateFrom}
            onChange={e => setParam('from', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('lessonRequests.filter.dateTo')}
          <Input
            type="date"
            className="h-9 w-[160px]"
            value={dateTo}
            onChange={e => setParam('to', e.target.value)}
          />
        </label>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('from');
              next.delete('to');
              setSearchParams(next, { replace: true });
            }}
          >
            {t('lessonRequests.filter.resetDates')}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {inconsistentCount > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <strong>{t('lessonRequests.mismatch.count', { count: inconsistentCount })}</strong>{' '}
          {t('lessonRequests.mismatch.hint')}
        </div>
      )}

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-lg">{t('lessonRequests.list.title')}</CardTitle>
          <CardDescription>
            {loading ? t('common.loading') : t('lessonRequests.list.found', { count: visible.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">{t('lessonRequests.col.id')}</TableHead>
                <TableHead className="w-[110px]">{t('lessonRequests.col.type')}</TableHead>
                <TableHead className="min-w-[10rem]">{t('lessonRequests.col.groupLesson')}</TableHead>
                <TableHead>{t('lessonRequests.col.dateTime')}</TableHead>
                <TableHead>{t('lessonRequests.col.teacher')}</TableHead>
                <TableHead>{t('lessonRequests.col.status')}</TableHead>
                <TableHead className="text-right">{t('lessonRequests.col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t('lessonRequests.list.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(req => {
                  const isOpen = expanded === req.id;
                  const bad = inconsistent(req);
                  return [
                    <TableRow
                      key={req.id}
                      className={`cursor-pointer ${bad ? 'bg-red-50/60 dark:bg-red-950/40' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : req.id)}
                    >
                      <TableCell className="text-muted-foreground tabular-nums">{req.id}</TableCell>
                      <TableCell className="font-medium">
                        {typeLabel(t, req.request_type)}
                        {req.status === 'approved' && req.cancel_resolution === 'add_replacement' && (
                          <Badge
                            variant="secondary"
                            className="mt-1 block w-fit bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200 px-1.5 py-0 text-[10px] font-medium dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/40 dark:border-sky-800/60"
                          >
                            {t('lessonRequests.row.lessonAtEnd')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* The group is not linked because this app has no group-detail
                            page to link to; a link to a 404 is worse than none. The lesson
                            is linked for admins, who have the event editor. */}
                        <div className="font-medium">{req.group_name || t('lessonRequests.row.group', { id: req.group_id })}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.event_id && !isHeadTeacher ? (
                            <Link
                              to={`/admin/events/${req.event_id}/edit`}
                              className="hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {req.lesson_title || t('lessonRequests.row.lesson', { id: req.event_id })}
                            </Link>
                          ) : (
                            req.lesson_title || '—'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatExact(req.original_datetime)}
                        {req.request_type === 'reschedule' && req.new_datetime && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowRight className="h-3 w-3 shrink-0" aria-label={t('lessonRequests.row.movedTo')} />
                            {formatExact(req.new_datetime)}
                          </span>
                        )}
                        {req.replacement_datetime && (
                          <span className="block text-xs text-muted-foreground">
                            + {formatExact(req.replacement_datetime)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={bad ? 'text-red-700 font-medium dark:text-red-300' : ''}>
                          {req.current_event_teacher_name || '—'}
                        </span>
                        {req.group_teacher_name &&
                          req.current_event_teacher_id !== req.group_teacher_id && (
                            <Badge
                              variant="secondary"
                              className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/40"
                            >
                              {t('lessonRequests.row.substitute')}
                            </Badge>
                          )}
                      </TableCell>
                      <TableCell>
                        {statusBadge(req.status)}
                        {bad && (
                          <span className="mt-1 block text-xs font-medium text-red-700 dark:text-red-300">
                            {t('lessonRequests.row.notApplied')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top" onClick={e => e.stopPropagation()}>
                        {req.status === 'pending_teacher' && (
                          <span className="text-xs text-muted-foreground italic">
                            {t('lessonRequests.row.waitingTeacher')}
                          </span>
                        )}
                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 items-end">
                            {req.request_type === 'cancel' && (
                              <fieldset className="w-full min-w-[200px] max-w-[260px] space-y-1.5 text-left">
                                <legend className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                  {t('lessonRequests.decision.legend')}
                                </legend>
                                {CANCEL_RESOLUTION_OPTIONS.map(opt => (
                                  <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-start gap-2 text-xs"
                                  >
                                    <input
                                      type="radio"
                                      className="mt-0.5 shrink-0"
                                      name={`cancel-resolution-${req.id}`}
                                      value={opt.value}
                                      checked={cancelChoice[req.id] === opt.value}
                                      onChange={() =>
                                        setCancelChoice(prev => ({ ...prev, [req.id]: opt.value }))
                                      }
                                      disabled={processing === req.id}
                                    />
                                    <span>
                                      <span className="font-medium">{t(opt.label)}</span>
                                      <span className="block text-muted-foreground">
                                        — {t(opt.hint)}
                                      </span>
                                    </span>
                                  </label>
                                ))}
                              </fieldset>
                            )}
                            <Input
                              placeholder={t('lessonRequests.decision.comment')}
                              className="h-8 w-[150px] text-xs"
                              value={adminComment[req.id] || ''}
                              onChange={e =>
                                setAdminComment(prev => ({ ...prev, [req.id]: e.target.value }))
                              }
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-950/40 dark:hover:text-green-300 dark:hover:border-green-800/60"
                                onClick={() => handleApprove(req)}
                                disabled={processing === req.id || needsCancelChoice(req)}
                                title={needsCancelChoice(req) ? t('lessonRequests.decision.chooseFirst') : undefined}
                              >
                                {t('lessonRequests.decision.approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-800/60"
                                onClick={() => handleReject(req.id)}
                                disabled={processing === req.id}
                              >
                                {t('lessonRequests.decision.reject')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>,

                    isOpen && (
                      <TableRow key={`${req.id}-details`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-6">
                          {bad && (
                            <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                              <strong>{t('lessonRequests.detail.notAppliedTitle')}</strong>
                              <div className="mt-1">
                                {withBoldParams(t('lessonRequests.detail.notAppliedBody'), {
                                  approved: req.confirmed_teacher_name || req.substitute_teacher_name || '—',
                                  current: req.current_event_teacher_name || '—',
                                })}
                              </div>
                              {req.consistency_note && (
                                <div className="mt-1 text-red-800 dark:text-red-300">{req.consistency_note}</div>
                              )}
                            </div>
                          )}

                          <div className="grid gap-6 @4xl:grid-cols-[1fr_320px]">
                            <dl className="grid gap-4 @xl:grid-cols-2 @6xl:grid-cols-3">
                              <Fact label={t('lessonRequests.detail.type')}>{typeLabel(t, req.request_type)}</Fact>
                              <Fact label={t('lessonRequests.col.status')}>{statusLabel(t, req.status)}</Fact>
                              <Fact label={t('lessonRequests.detail.requester')}>{req.requester_name}</Fact>
                              <Fact label={t('lessonRequests.detail.created')}>{formatExact(req.created_at)}</Fact>
                              <Fact label={t('lessonRequests.detail.originalTime')}>
                                {formatExact(req.original_datetime)}
                              </Fact>
                              {req.request_type === 'reschedule' && (
                                <Fact label={t('lessonRequests.detail.newTime')}>{formatExact(req.new_datetime)}</Fact>
                              )}
                              {req.request_type === 'cancel' && (
                                <Fact label={t('lessonRequests.decision.legend')}>
                                  {cancelResolutionLabel(t, req.cancel_resolution)
                                    ? req.status === 'pending'
                                      ? t('lessonRequests.detail.teacherProposal', {
                                          resolution: cancelResolutionLabel(t, req.cancel_resolution) ?? '',
                                        })
                                      : cancelResolutionLabel(t, req.cancel_resolution)
                                    : '—'}
                                </Fact>
                              )}
                              {req.replacement_event_id && (
                                <Fact label={t('lessonRequests.detail.addedLesson')}>
                                  {req.replacement_lesson_title || t('lessonRequests.row.lesson', { id: req.replacement_event_id })}
                                  <span className="block text-xs text-muted-foreground">
                                    {formatExact(req.replacement_datetime)}
                                  </span>
                                </Fact>
                              )}
                              <Fact label={t('lessonRequests.detail.candidates')}>
                                {req.substitute_teacher_names?.length
                                  ? req.substitute_teacher_names.join(', ')
                                  : req.substitute_teacher_name || '—'}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.confirmedTeacher')}>
                                {req.confirmed_teacher_name}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.currentTeacher')}>
                                <span className={bad ? 'text-red-700 font-medium dark:text-red-300' : ''}>
                                  {req.current_event_teacher_name}
                                </span>
                              </Fact>
                              <Fact label={t('lessonRequests.detail.groupTeacher')}>
                                {req.group_teacher_name}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.attendanceOwner')}>
                                {req.attendance_owner_name}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.attendance')}>
                                {req.attendance_marked == null
                                  ? '—'
                                  : req.attendance_marked
                                    ? t('lessonRequests.detail.attendanceMarked')
                                    : t('lessonRequests.detail.attendanceNotMarked')}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.lessonState')}>
                                {req.lesson_is_active == null
                                  ? '—'
                                  : req.lesson_is_active
                                    ? t('lessonRequests.detail.lessonActive')
                                    : t('lessonRequests.detail.lessonCancelled')}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.resolver')}>
                                {req.resolver_name
                                  ? `${req.resolver_name}${
                                      roleLabel(t, req.resolver_role)
                                        ? ` (${roleLabel(t, req.resolver_role)})`
                                        : ''
                                    }`
                                  : '—'}
                              </Fact>
                              <Fact label={t('lessonRequests.detail.resolvedAt')}>{formatExact(req.resolved_at)}</Fact>
                              <Fact label={t('lessonRequests.detail.reason')}>{req.reason}</Fact>
                              <Fact label={t('lessonRequests.detail.resolutionComment')}>{req.admin_comment}</Fact>
                            </dl>

                            <div className="rounded-md border bg-background p-4">
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {t('lessonRequests.timeline.title')}
                              </div>
                              <Timeline req={req} />
                            </div>
                          </div>
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
      </>
      )}
    </div>
  );
}
