import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { lessonHeading, pendingAfterClass, t, type Locale } from '../../lib/classMaterials';
import { lessonPath } from '../../lib/lessonLinks';
import type { FeedLessonEntry, MaterialItem } from '../../services/api/classMaterials';
import MaterialRow from './MaterialRow';

interface Props {
  entry: FeedLessonEntry;
  locale: Locale;
  onOpenItem: (item: MaterialItem) => void;
  /** True for the ~2s ring after the `/materials?lesson=<id>` deep link resolves to this card. */
  highlighted?: boolean;
  /** Opens this lesson's materials to add to. Offered only on a lesson the viewer manages. */
  onAdd?: (lessonId: number) => void;
}

/**
 * One lesson's row on the «Материалы» page: its heading, a «снят с расписания» badge for a
 * cancelled lesson, and its materials — rendered straight from the feed payload (`MaterialRow`
 * only, no per-item actions), never refetched per card. A lesson with no items reaches the feed
 * only for a manager (their own lessons around today), who gets an «Add» button and an invitation
 * to add the first material; the plain empty line is for the other card that can arrive empty: a
 * deep-linked lesson pinned in via `getClassMaterials`.
 */
export default function LessonMaterialsCard({ entry, locale, onOpenItem, highlighted, onAdd }: Props) {
  const { lesson, items, pending_after_end: pending } = entry;
  // A cancelled lesson is not offered: nobody teaches it.
  const canAdd = !!onAdd && !!entry.can_manage && lesson.is_active;

  return (
    <div
      id={`material-lesson-${lesson.id}`}
      className={`rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow ${
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-semibold text-foreground">
          {/* The heading opens the lesson's own page, at its materials (2026-09-28). */}
          <Link
            to={lessonPath(lesson.id, 'materials')}
            className="group/lesson inline-flex items-start gap-1 hover:text-primary hover:underline"
            title={t('openLesson', locale)}
          >
            {lessonHeading(lesson, locale)}
            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground group-hover/lesson:text-primary" aria-hidden />
          </Link>
        </h3>
        {!lesson.is_active && (
          <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t('cancelledLesson', locale)}
          </span>
        )}
        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd(lesson.id)}
            className="inline-flex h-9 flex-none items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('addButton', locale)}
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <div className="mt-2 divide-y divide-border">
          {items.map((item) => (
            <MaterialRow key={item.id} item={item} locale={locale} onOpen={onOpenItem} density="comfortable" />
          ))}
        </div>
      ) : pending === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{canAdd ? t('addFirst', locale) : t('empty', locale)}</p>
      ) : null}

      {pending > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{pendingAfterClass(pending, locale)}</p>
      )}
    </div>
  );
}
