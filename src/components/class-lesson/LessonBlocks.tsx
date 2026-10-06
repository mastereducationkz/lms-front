import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Plus, Star, UserX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clockKz, stampKz } from '../../lib/classLessonPage';
import type { LessonHomework, LessonView } from '../../services/api/classLessons';

type T = (ru: string, en: string) => string;
const tFor = (view: LessonView): T => (ru, en) => (view.viewer.locale === 'ru' ? ru : en);

/** The room right now (staff, while the lesson runs), refreshed by the page every minute. */
export function LiveRoom({ view }: { view: LessonView }) {
  const t = tFor(view);
  const live = view.live;
  if (!live) return null;
  const full = live.expected > 0 && live.in_room >= live.expected;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {live.in_room}<span className="text-base font-medium text-muted-foreground"> {t('из', 'of')} {live.expected}</span>
        </p>
        <p className="text-sm text-muted-foreground">{t('учеников в комнате', 'students in the room')}</p>
        {!live.teacher_in && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('Преподавателя нет в комнате', 'The teacher is not in the room')}
          </span>
        )}
      </div>
      {live.missing.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <UserX className="h-3.5 w-3.5" aria-hidden />{t('Не зашли', 'Not in the room')}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {live.missing.map((m) => (
              <li key={m.user_id} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{m.name}</li>
            ))}
          </ul>
        </div>
      ) : full ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{t('Все в комнате', 'Everyone is in')}</p>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {live.unknown > 0 && `${t('Неопознанных аккаунтов', 'Unconfirmed accounts')}: ${live.unknown} · `}
        {live.updated_at ? `${t('Обновлено в', 'Updated at')} ${clockKz(live.updated_at, view.viewer.locale)}` : t('Ждём данные из Meet…', 'Waiting for Meet…')}
      </p>
    </div>
  );
}

const MY_MARK: Record<string, [string, string, string]> = {
  attended: ['Был', 'Present', 'text-emerald-700 dark:text-emerald-300'],
  late: ['Опоздал', 'Late', 'text-amber-700 dark:text-amber-300'],
  missed: ['Не был', 'Absent', 'text-rose-700 dark:text-rose-300'],
  registered: ['Ещё не отмечено', 'Not marked yet', 'text-muted-foreground'],
  cancelled: ['Урок отменён', 'Lesson cancelled', 'text-muted-foreground'],
  removed: ['Снят с урока', 'Taken off the lesson', 'text-muted-foreground'],
};

/** A student's own mark and балл за активность — never a classmate's. */
export function MyMark({ view }: { view: LessonView }) {
  const t = tFor(view);
  const me = view.me;
  if (!me) return null;
  const [ruLabel, enLabel, tone] = MY_MARK[me.status] ?? MY_MARK.registered;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div>
        <p className="text-xs text-muted-foreground">{t('Посещаемость', 'Attendance')}</p>
        <p className={cn('text-lg font-semibold', tone)}>
          {view.viewer.locale === 'ru' ? ruLabel : enLabel}
          {me.excused && <span className="ml-1.5 text-sm font-normal text-muted-foreground">({t('уважительная', 'excused')})</span>}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('Балл за активность', 'Activity score')}</p>
        <p className="flex items-center gap-1 text-lg font-semibold text-foreground">
          <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" aria-hidden />
          {me.activity_score != null ? `${me.activity_score}/10` : '—'}
        </p>
      </div>
    </div>
  );
}

const HW_STATUS: Record<string, [string, string, string]> = {
  not_submitted: ['Не сдано', 'Not submitted', 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'],
  submitted: ['Сдано, ждёт проверки', 'Submitted, awaiting grading', 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'],
  graded: ['Проверено', 'Graded', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'],
};

/** This lesson's homework: staff see how many handed in, a student sees their own status. */
export function HomeworkList({ view }: { view: LessonView }) {
  const t = tFor(view);
  const ru = view.viewer.locale === 'ru';
  return (
    <div>
      {view.homework.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('К этому уроку домашнего задания нет.', 'No homework for this lesson.')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {view.homework.map((hw) => <HomeworkRow key={hw.id} hw={hw} view={view} ru={ru} t={t} />)}
        </ul>
      )}
      {view.homework_new_url && (
        <Link
          to={view.homework_new_url}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('Задать ДЗ к уроку', 'Assign homework')}
        </Link>
      )}
    </div>
  );
}

function HomeworkRow({ hw, view, ru, t }: { hw: LessonHomework; view: LessonView; ru: boolean; t: T }) {
  const status = hw.my ? HW_STATUS[hw.my.status] : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <Link to={`/homework/${hw.id}`} className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground hover:underline">
          <ClipboardList className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
          <span className="truncate">{hw.title}</span>
        </Link>
        {hw.due && <p className="text-[11px] text-muted-foreground">{t('Срок', 'Due')}: {stampKz(hw.due, view.viewer.locale)}</p>}
      </div>
      {hw.submitted != null && hw.total != null && (
        <span className="text-xs tabular-nums text-muted-foreground">{t('Сдали', 'Handed in')} {hw.submitted}/{hw.total}</span>
      )}
      {status && hw.my && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status[2])}>
          {ru ? status[0] : status[1]}
          {hw.my.status === 'graded' && hw.my.score != null ? ` · ${hw.my.score}${hw.my.max_score != null ? `/${hw.my.max_score}` : ''}` : ''}
        </span>
      )}
    </li>
  );
}

const REQUEST_TYPE: Record<string, [string, string]> = {
  substitution: ['Замена', 'Substitute'], reschedule: ['Перенос', 'Reschedule'], cancel: ['Отмена урока', 'Cancel lesson'],
};
const REQUEST_STATUS: Record<string, [string, string]> = {
  pending: ['на рассмотрении', 'pending'], pending_approval: ['ждёт одобрения', 'awaiting approval'],
  confirmed: ['подтверждена', 'confirmed'], approved: ['одобрена', 'approved'], rejected: ['отклонена', 'rejected'],
  declined: ['отклонена', 'declined'], cancelled: ['отозвана', 'withdrawn'],
};

/** Requests about this lesson (substitute, reschedule, cancel) and, for its teacher, new ones. */
export function RequestsBlock({ view }: { view: LessonView }) {
  const t = tFor(view);
  const ru = view.viewer.locale === 'ru';
  const navigate = useNavigate();
  const pendingType = new Set(view.requests.filter((r) => r.status.startsWith('pending')).map((r) => r.type));
  return (
    <div>
      {view.requests.length > 0 ? (
        <ul className="mb-3 divide-y divide-border">
          {view.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium text-foreground">{ru ? REQUEST_TYPE[r.type]?.[0] ?? r.type : REQUEST_TYPE[r.type]?.[1] ?? r.type}</span>
              <span className="text-xs text-muted-foreground">
                {ru ? REQUEST_STATUS[r.status]?.[0] ?? r.status : REQUEST_STATUS[r.status]?.[1] ?? r.status}
                {r.requester ? ` · ${r.requester}` : ''}
                {r.created_at ? ` · ${stampKz(r.created_at, view.viewer.locale)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !view.request_new_url && <p className="text-sm text-muted-foreground">{t('Заявок по этому уроку нет.', 'No requests for this lesson.')}</p>
      )}
      {view.request_new_url && (
        <div className="flex flex-wrap gap-2">
          {(['substitution', 'reschedule', 'cancel'] as const).map((type) => (
            <button
              key={type}
              type="button"
              disabled={pendingType.has(type)}
              onClick={() => navigate(`${view.request_new_url}&type=${type}`)}
              className={cn(
                'rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
                type === 'cancel' ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
              )}
            >
              {ru ? REQUEST_TYPE[type][0] : REQUEST_TYPE[type][1]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
