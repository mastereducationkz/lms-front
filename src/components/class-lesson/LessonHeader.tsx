import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ListChecks, Video } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  clockKz, joinState, journalUrl, lessonWhen, SECTION_LABELS, type PageSection,
} from '../../lib/classLessonPage';
import { lessonPath } from '../../lib/lessonLinks';
import type { LessonGroup, LessonStatus, LessonView } from '../../services/api/classLessons';

const STATUS: Record<LessonStatus, { ru: string; en: string; tone: string }> = {
  upcoming: { ru: 'Скоро', en: 'Upcoming', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  live: { ru: 'Идёт сейчас', en: 'Live now', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  finished: { ru: 'Прошёл', en: 'Finished', tone: 'bg-muted text-muted-foreground' },
  cancelled: { ru: 'Отменён', en: 'Cancelled', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
};

interface Props {
  view: LessonView;
  group: LessonGroup | null;
  onGroup: (groupId: number) => void;
  sections: PageSection[];
  onJump: (section: PageSection) => void;
  now: Date;
}

/** Group name without the « - Teacher» tail the school appends to every group. */
function groupLabel(name: string): string {
  const dash = name.lastIndexOf(' - ');
  return dash > 0 ? name.slice(0, dash) : name;
}

/**
 * The top of `/lessons/:id`, kept on screen while the page scrolls: which lesson, its state, the one
 * button that matters while it runs («Войти»), the way to the neighbouring lessons of the group, and
 * chips that jump to each section below.
 */
export default function LessonHeader({ view, group, onGroup, sections, onJump, now }: Props) {
  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
  const status = STATUS[view.status];
  const join = joinState(view, now);
  const journal = group ? journalUrl(view.viewer.role, group.id, view.start) : null;
  const stuck = useStuck();

  return (
    <header
      ref={stuck.ref}
      style={{ top: 'var(--topbar-h, 0px)' }}
      className={cn(
        'sticky z-[9] border border-border bg-card/95 px-4 pb-3 pt-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-5',
        // Only a header that is actually stuck hangs off the topbar (no top edge); at rest the
        // page padding keeps it apart from the topbar, so it is a whole card.
        stuck.on ? 'rounded-b-2xl border-t-0' : 'rounded-2xl',
      )}
    >
      <div className="flex items-start gap-3">
        <Link
          to="/calendar"
          className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t('К календарю', 'Back to calendar')}
          title={t('К календарю', 'Back to calendar')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', status.tone)}>
              {view.status === 'live' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" />}
              {ru ? status.ru : status.en}
            </span>
            <span className="text-xs text-muted-foreground">{lessonWhen(view.start, view.end, view.viewer.locale)}</span>
          </div>
          <h1 className="mt-1 line-clamp-2 break-words text-lg font-bold leading-snug text-foreground sm:text-xl" title={view.title}>
            {group ? groupLabel(group.name) : view.title}
            {group?.lesson_number ? <span className="font-normal text-muted-foreground"> · {t('урок', 'lesson')} {group.lesson_number}</span> : null}
          </h1>
          {view.topic && <p className="line-clamp-2 text-sm text-brand-subtle-foreground" title={view.topic}>{view.topic}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {view.teacher ? view.teacher.name : t('Преподаватель не указан', 'No teacher set')}
            {view.is_substitution && (
              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {t('Замена', 'Substitute')}{view.regular_teacher ? ` · ${t('группа', 'group')}: ${view.regular_teacher.name}` : ''}
              </span>
            )}
          </p>
        </div>
        {join.kind !== 'hidden' && (
          join.kind === 'open' ? (
            <a
              href={view.join.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Video className="h-4 w-4" aria-hidden />
              {t('Войти', 'Join')}
            </a>
          ) : (
            <span
              className="inline-flex flex-none cursor-not-allowed items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
              title={t('Кнопка откроется за 10 минут до начала', 'The button opens 10 minutes before the start')}
            >
              <Video className="h-4 w-4" aria-hidden />
              {t(`Откроется в ${clockKz(join.opensAt, 'ru')}`, `Opens at ${clockKz(join.opensAt, 'en')}`)}
            </span>
          )
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {view.groups.length > 1 && (
          <select
            value={group?.id ?? ''}
            onChange={(e) => onGroup(Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
            aria-label={t('Группа', 'Group')}
          >
            {view.groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g.name)}</option>)}
          </select>
        )}
        {group && (
          <div className="flex items-center gap-1">
            <NavArrow to={group.prev ? lessonPath(group.prev.id) : null} label={t('Предыдущий урок', 'Previous lesson')} dir="prev" />
            <NavArrow to={group.next ? lessonPath(group.next.id) : null} label={t('Следующий урок', 'Next lesson')} dir="next" />
          </div>
        )}
        {journal && (
          <Link to={journal} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            {t('Все уроки группы', 'All group lessons')}
          </Link>
        )}
      </div>

      {sections.length > 1 && (
        <nav className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" aria-label={t('Разделы урока', 'Lesson sections')} data-tip="lesson-sections">
          {sections.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onJump(key)}
              className="flex-none rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              {ru ? SECTION_LABELS[key][0] : SECTION_LABELS[key][1]}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Whether a sticky element sits at its `top` offset in the scrolling <main>, i.e. is stuck. */
function useStuck() {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest('main');
    if (!el || !scroller) return;
    const check = () => {
      const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      setOn(scroller.scrollTop > 0 && offset <= (parseFloat(getComputedStyle(el).top) || 0) + 0.5);
    };
    check();
    scroller.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      scroller.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  return { ref, on };
}

function NavArrow({ to, label, dir }: { to: string | null; label: string; dir: 'prev' | 'next' }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  const cls = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border';
  if (!to) {
    return <span className={cn(cls, 'cursor-not-allowed opacity-40')} aria-label={label} title={label}><Icon className="h-4 w-4" /></span>;
  }
  return (
    <Link to={to} className={cn(cls, 'bg-card text-foreground hover:bg-muted')} aria-label={label} title={label}>
      <Icon className="h-4 w-4" />
    </Link>
  );
}
