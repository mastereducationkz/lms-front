import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../services/api';
import type { LessonRequest } from '../../types';
import { formatInKZ } from '../../lib/datetime';
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
const APPROVER_ROLE_LABELS: Record<string, string> = {
  head_teacher: 'старший преподаватель',
  teacher: 'преподаватель',
  admin: 'администратор',
  head_curator: 'старший куратор',
  curator: 'куратор',
};

const TYPE_LABELS: Record<string, string> = {
  substitution: 'Замена',
  reschedule: 'Перенос',
  cancel: 'Отмена',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'Одобрено',
  rejected: 'Отклонено',
  pending_teacher: 'Ждёт педагога',
  pending: 'Ждёт решения',
};

const roleLabel = (role?: string | null) =>
  role ? APPROVER_ROLE_LABELS[role] ?? role : null;

const typeLabel = (t: string) => TYPE_LABELS[t] ?? t;

/** Exact Almaty date and time. The list used to print only a short date, so two requests for
 *  the same day were indistinguishable and "19:00" — the thing being argued about — was
 *  nowhere on the page. */
const formatExact = (value?: string | null) =>
  value
    ? formatInKZ(value, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

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
  const steps: { at?: string | null; title: string; detail?: string | null }[] = [
    {
      at: req.created_at,
      title: 'Заявка создана',
      detail: req.requester_name ? `${req.requester_name}` : null,
    },
  ];

  if (req.confirmed_teacher_name) {
    steps.push({ at: null, title: 'Выбран замещающий педагог', detail: req.confirmed_teacher_name });
  }

  if (req.status === 'approved' || req.status === 'rejected') {
    const who = [req.resolver_name, roleLabel(req.resolver_role)].filter(Boolean).join(', ');
    steps.push({
      at: req.resolved_at,
      title: req.status === 'approved' ? 'Одобрено' : 'Отклонено',
      detail: who || null,
    });
  }

  if (req.status === 'approved' && req.is_applied === true) {
    steps.push({
      at: null,
      title: 'Изменение применено к уроку',
      detail: req.current_event_teacher_name
        ? `Урок ведёт ${req.current_event_teacher_name}`
        : null,
    });
  }

  if (req.status === 'approved' && req.is_applied === false) {
    steps.push({
      at: null,
      title: 'Изменение НЕ применено',
      detail: req.current_event_teacher_name
        ? `В расписании урок за ${req.current_event_teacher_name}`
        : null,
    });
  }

  if (req.attendance_marked) {
    steps.push({ at: null, title: 'Посещаемость отмечена' });
  }

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              s.title.includes('НЕ применено') ? 'bg-red-500' : 'bg-muted-foreground/40'
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
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState<Record<number, string>>({});
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
    } catch (err) {
      console.error('Failed to fetch lesson requests:', err);
      setError('Не удалось загрузить заявки. Обновите страницу или попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, variant]);

  const handleApprove = async (id: number) => {
    try {
      setProcessing(id);
      await apiClient.approveLessonRequest(id, adminComment[id]);
      await fetchRequests();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError('Не удалось одобрить заявку.');
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
      setError('Не удалось отклонить заявку.');
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
    const label = STATUS_LABELS[status] ?? status;
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">{label}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{label}</Badge>;
      case 'pending_teacher':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">{label}</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">{label}</Badge>;
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
          ['requests', 'Запросы'],
          ['stats', 'Статистика по учителям'],
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
          <h1 className="text-3xl font-bold tracking-tight">Заявки по урокам</h1>
          <p className="text-muted-foreground mt-1">
            {isHeadTeacher
              ? 'Замены, переносы и отмены от ваших педагогов'
              : 'Замены, переносы и отмены — с полной историей решений'}
          </p>
        </div>
        <div className="flex rounded-md shadow-sm">
          {([
            ['pending,pending_teacher', 'Ожидают'],
            ['approved', 'Одобрены'],
            ['rejected', 'Отклонены'],
            ...(isHeadTeacher ? [] : [['', 'Все'] as [string, string]]),
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
          Дата урока с
          <Input
            type="date"
            className="h-9 w-[160px]"
            value={dateFrom}
            onChange={e => setParam('from', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          по
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
            Сбросить даты
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {inconsistentCount > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>Расхождение с расписанием: {inconsistentCount}.</strong>{' '}
          Одобренная замена не отражена в уроке — откройте заявку, чтобы увидеть подробности.
        </div>
      )}

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-lg">Заявки</CardTitle>
          <CardDescription>
            {loading ? 'Загрузка…' : `Найдено заявок: ${visible.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">№</TableHead>
                <TableHead className="w-[110px]">Тип</TableHead>
                <TableHead>Группа и урок</TableHead>
                <TableHead>Дата и время</TableHead>
                <TableHead>Кто ведёт</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Загрузка…
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    По этим условиям заявок нет.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(req => {
                  const isOpen = expanded === req.id;
                  const bad = inconsistent(req);
                  return [
                    <TableRow
                      key={req.id}
                      className={`cursor-pointer ${bad ? 'bg-red-50/60' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : req.id)}
                    >
                      <TableCell className="text-muted-foreground tabular-nums">{req.id}</TableCell>
                      <TableCell className="font-medium">{typeLabel(req.request_type)}</TableCell>
                      <TableCell>
                        {/* The group is not linked because this app has no group-detail
                            page to link to; a link to a 404 is worse than none. The lesson
                            is linked for admins, who have the event editor. */}
                        <div className="font-medium">{req.group_name || `Группа ${req.group_id}`}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.event_id && !isHeadTeacher ? (
                            <Link
                              to={`/admin/events/${req.event_id}/edit`}
                              className="hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {req.lesson_title || `Урок ${req.event_id}`}
                            </Link>
                          ) : (
                            req.lesson_title || '—'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatExact(req.original_datetime)}
                        {req.request_type === 'reschedule' && req.new_datetime && (
                          <span className="block text-xs text-muted-foreground">
                            → {formatExact(req.new_datetime)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={bad ? 'text-red-700 font-medium' : ''}>
                          {req.current_event_teacher_name || '—'}
                        </span>
                        {req.group_teacher_name &&
                          req.current_event_teacher_id !== req.group_teacher_id && (
                            <Badge
                              variant="secondary"
                              className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-100"
                            >
                              Замена
                            </Badge>
                          )}
                      </TableCell>
                      <TableCell>
                        {statusBadge(req.status)}
                        {bad && (
                          <span className="mt-1 block text-xs font-medium text-red-700">
                            не применено
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top" onClick={e => e.stopPropagation()}>
                        {req.status === 'pending_teacher' && (
                          <span className="text-xs text-muted-foreground italic">
                            Ждём подтверждения педагога
                          </span>
                        )}
                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 items-end">
                            <Input
                              placeholder="Комментарий…"
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
                                className="h-7 text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                                onClick={() => handleApprove(req.id)}
                                disabled={processing === req.id}
                              >
                                Одобрить
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                onClick={() => handleReject(req.id)}
                                disabled={processing === req.id}
                              >
                                Отклонить
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
                            <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
                              <strong>Одобренная замена не применена к уроку.</strong>
                              <div className="mt-1">
                                Одобрен педагог{' '}
                                <strong>
                                  {req.confirmed_teacher_name || req.substitute_teacher_name || '—'}
                                </strong>
                                , но в расписании урок закреплён за{' '}
                                <strong>{req.current_event_teacher_name || '—'}</strong>.
                              </div>
                              {req.consistency_note && (
                                <div className="mt-1 text-red-800">{req.consistency_note}</div>
                              )}
                            </div>
                          )}

                          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Fact label="Тип заявки">{typeLabel(req.request_type)}</Fact>
                              <Fact label="Статус">{STATUS_LABELS[req.status] ?? req.status}</Fact>
                              <Fact label="Автор заявки">{req.requester_name}</Fact>
                              <Fact label="Создана">{formatExact(req.created_at)}</Fact>
                              <Fact label="Исходное время урока">
                                {formatExact(req.original_datetime)}
                              </Fact>
                              {req.request_type === 'reschedule' && (
                                <Fact label="Новое время">{formatExact(req.new_datetime)}</Fact>
                              )}
                              <Fact label="Предложенные кандидаты">
                                {req.substitute_teacher_names?.length
                                  ? req.substitute_teacher_names.join(', ')
                                  : req.substitute_teacher_name || '—'}
                              </Fact>
                              <Fact label="Подтверждённый педагог">
                                {req.confirmed_teacher_name}
                              </Fact>
                              <Fact label="Сейчас урок ведёт">
                                <span className={bad ? 'text-red-700 font-medium' : ''}>
                                  {req.current_event_teacher_name}
                                </span>
                              </Fact>
                              <Fact label="Ответственный за группу">
                                {req.group_teacher_name}
                              </Fact>
                              <Fact label="Отмечает посещаемость">
                                {req.attendance_owner_name}
                              </Fact>
                              <Fact label="Посещаемость">
                                {req.attendance_marked == null
                                  ? '—'
                                  : req.attendance_marked
                                    ? 'Отмечена'
                                    : 'Не отмечена'}
                              </Fact>
                              <Fact label="Состояние урока">
                                {req.lesson_is_active == null
                                  ? '—'
                                  : req.lesson_is_active
                                    ? 'Активен'
                                    : 'Отменён'}
                              </Fact>
                              <Fact label="Кто решил">
                                {req.resolver_name
                                  ? `${req.resolver_name}${
                                      roleLabel(req.resolver_role)
                                        ? ` (${roleLabel(req.resolver_role)})`
                                        : ''
                                    }`
                                  : '—'}
                              </Fact>
                              <Fact label="Когда решено">{formatExact(req.resolved_at)}</Fact>
                              <Fact label="Причина">{req.reason}</Fact>
                              <Fact label="Комментарий решения">{req.admin_comment}</Fact>
                            </dl>

                            <div className="rounded-md border bg-background p-4">
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                                Хронология
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
