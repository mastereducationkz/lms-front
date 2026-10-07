import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Plus, Star, UserX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clockKz, stampKz } from '../../lib/classLessonPage';
import { t as translate, type Locale, type MessageKey, type Params } from '../../lib/i18n';
import type { LessonHomework, LessonView } from '../../services/api/classLessons';

/*
 * These blocks take the viewer's `locale` as a prop rather than calling useT(): the Google Meet
 * side panel renders LiveRoom too, and it is a separate entry with no AuthProvider (and must not
 * pull the main app's providers into its bundle).
 */
type T = (key: MessageKey, params?: Params) => string;
const tFor = (locale: Locale): T => (key, params) => translate(key, params, locale);

interface BlockProps { view: LessonView; locale: Locale }

/** The room right now (staff, while the lesson runs), refreshed by the page every minute. */
export function LiveRoom({ view, locale }: BlockProps) {
  const t = tFor(locale);
  const live = view.live;
  if (!live) return null;
  const full = live.expected > 0 && live.in_room >= live.expected;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {live.in_room}<span className="text-base font-medium text-muted-foreground"> {t('classLesson.live.ofExpected', { expected: live.expected })}</span>
        </p>
        <p className="text-sm text-muted-foreground">{t('classLesson.live.studentsInRoom')}</p>
        {!live.teacher_in && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('classLesson.live.teacherAbsent')}
          </span>
        )}
      </div>
      {live.missing.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <UserX className="h-3.5 w-3.5" aria-hidden />{t('classLesson.live.missing')}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {live.missing.map((m) => (
              <li key={m.user_id} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{m.name}</li>
            ))}
          </ul>
        </div>
      ) : full ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{t('classLesson.live.everyoneIn')}</p>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {live.unknown > 0 && `${t('classLesson.live.unconfirmed', { count: live.unknown })} · `}
        {live.updated_at ? t('classLesson.live.updatedAt', { time: clockKz(live.updated_at, locale) }) : t('classLesson.live.waiting')}
      </p>
    </div>
  );
}

const MY_MARK: Record<string, [MessageKey, string]> = {
  attended: ['classLesson.mark.attended', 'text-emerald-700 dark:text-emerald-300'],
  late: ['classLesson.mark.late', 'text-amber-700 dark:text-amber-300'],
  missed: ['classLesson.mark.missed', 'text-rose-700 dark:text-rose-300'],
  registered: ['classLesson.myMark.registered', 'text-muted-foreground'],
  cancelled: ['classLesson.myMark.cancelled', 'text-muted-foreground'],
  removed: ['classLesson.myMark.removed', 'text-muted-foreground'],
};

/** A student's own mark and балл за активность — never a classmate's. */
export function MyMark({ view, locale }: BlockProps) {
  const t = tFor(locale);
  const me = view.me;
  if (!me) return null;
  const [label, tone] = MY_MARK[me.status] ?? MY_MARK.registered;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div>
        <p className="text-xs text-muted-foreground">{t('classLesson.section.register')}</p>
        <p className={cn('text-lg font-semibold', tone)}>
          {t(label)}
          {me.excused && <span className="ml-1.5 text-sm font-normal text-muted-foreground">({t('classLesson.myMark.excused')})</span>}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('classLesson.activityScore')}</p>
        <p className="flex items-center gap-1 text-lg font-semibold text-foreground">
          <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" aria-hidden />
          {me.activity_score != null ? `${me.activity_score}/10` : '—'}
        </p>
      </div>
    </div>
  );
}

const HW_STATUS: Record<string, [MessageKey, string]> = {
  not_submitted: ['classLesson.homework.notSubmitted', 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'],
  submitted: ['classLesson.homework.submitted', 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'],
  graded: ['classLesson.homework.graded', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'],
};

/** This lesson's homework: staff see how many handed in, a student sees their own status. */
export function HomeworkList({ view, locale }: BlockProps) {
  const t = tFor(locale);
  return (
    <div>
      {view.homework.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('classLesson.homework.none')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {view.homework.map((hw) => <HomeworkRow key={hw.id} hw={hw} locale={locale} t={t} />)}
        </ul>
      )}
      {view.homework_new_url && (
        <Link
          to={view.homework_new_url}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('classLesson.homework.assign')}
        </Link>
      )}
    </div>
  );
}

function HomeworkRow({ hw, locale, t }: { hw: LessonHomework; locale: Locale; t: T }) {
  const status = hw.my ? HW_STATUS[hw.my.status] : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <Link to={`/homework/${hw.id}`} className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground hover:underline">
          <ClipboardList className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
          <span className="truncate">{hw.title}</span>
        </Link>
        {hw.due && <p className="text-[11px] text-muted-foreground">{t('classLesson.homework.due', { when: stampKz(hw.due, locale) })}</p>}
      </div>
      {hw.submitted != null && hw.total != null && (
        <span className="text-xs tabular-nums text-muted-foreground">{t('classLesson.homework.handedIn', { submitted: hw.submitted, total: hw.total })}</span>
      )}
      {status && hw.my && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status[1])}>
          {t(status[0])}
          {hw.my.status === 'graded' && hw.my.score != null ? ` · ${hw.my.score}${hw.my.max_score != null ? `/${hw.my.max_score}` : ''}` : ''}
        </span>
      )}
    </li>
  );
}

const REQUEST_TYPE: Record<string, MessageKey> = {
  substitution: 'classLesson.request.substitution', reschedule: 'classLesson.request.reschedule', cancel: 'classLesson.request.cancel',
};
const REQUEST_STATUS: Record<string, MessageKey> = {
  pending: 'classLesson.request.pending', pending_approval: 'classLesson.request.pendingApproval',
  confirmed: 'classLesson.request.confirmed', approved: 'classLesson.request.approved', rejected: 'classLesson.request.rejected',
  declined: 'classLesson.request.declined', cancelled: 'classLesson.request.withdrawn',
};

/** Requests about this lesson (substitute, reschedule, cancel) and, for its teacher, new ones. */
export function RequestsBlock({ view, locale }: BlockProps) {
  const t = tFor(locale);
  const label = (table: Record<string, MessageKey>, value: string) => (table[value] ? t(table[value]) : value);
  const navigate = useNavigate();
  const pendingType = new Set(view.requests.filter((r) => r.status.startsWith('pending')).map((r) => r.type));
  return (
    <div>
      {view.requests.length > 0 ? (
        <ul className="mb-3 divide-y divide-border">
          {view.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium text-foreground">{label(REQUEST_TYPE, r.type)}</span>
              <span className="text-xs text-muted-foreground">
                {label(REQUEST_STATUS, r.status)}
                {r.requester ? ` · ${r.requester}` : ''}
                {r.created_at ? ` · ${stampKz(r.created_at, locale)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !view.request_new_url && <p className="text-sm text-muted-foreground">{t('classLesson.request.none')}</p>
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
              {t(REQUEST_TYPE[type])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
