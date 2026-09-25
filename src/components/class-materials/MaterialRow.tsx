import type { ReactNode } from 'react';
import { FileText, Image as ImageIcon, Link2, Music, Presentation } from 'lucide-react';
import { openClassMaterialItem, type MaterialItem } from '../../services/api/classMaterials';
import { formatSize, t, type Locale } from '../../lib/classMaterials';
import { materialIconKind, safeLinkHref } from '../../lib/classMaterialsView';

interface Props {
  item: MaterialItem;
  locale: Locale;
  /** Opens a file item in `MaterialViewer`; a link item opens through its own anchor instead. */
  onOpen: (item: MaterialItem) => void;
  /** Task 13's per-row ⋯ menu (rename / show-after-class / detach / moderate). Empty here. */
  actions?: ReactNode;
  /** 'compact' (default) keeps the lesson pop-up's tight spacing unchanged; 'comfortable' is a
   *  ≥44px touch target for a standalone list, e.g. the «Материалы» page. */
  density?: 'compact' | 'comfortable';
}

const ICONS = {
  file: FileText,
  image: ImageIcon,
  audio: Music,
  link: Link2,
  presentation: Presentation,
} as const;

const ROW_PADDING: Record<'compact' | 'comfortable', string> = {
  compact: 'py-1.5',
  comfortable: 'min-h-[44px] py-3',
};

/** The pop-up keeps one tight line per row; a standalone list has room for a two-line title. */
const TITLE_FIT: Record<'compact' | 'comfortable', string> = {
  compact: 'truncate',
  comfortable: 'line-clamp-2 break-words',
};

const OPEN_TARGET_CLASS =
  'flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * One row of `ClassMaterialsSection`: a kind icon, the title, its size (files only) and the
 * «after class» chip when the teacher gated it. A moderated item renders as a greyed-out
 * audit line — the reason instead of an open action — since only a moderator ever sees one
 * at all (the backend already leaves them out of everyone else's response).
 *
 * A link row is a real `<a target="_blank">` rather than a button: opening a tab after awaiting
 * the open log gets popup-blocked on iOS Safari and a slow Chrome. The open is logged
 * fire-and-forget on click; a link whose URL isn't http(s) is shown but not clickable.
 */
export default function MaterialRow({ item, locale, onOpen, actions, density = 'compact' }: Props) {
  const Icon = ICONS[materialIconKind(item)];
  const removed = item.removed;
  const padding = ROW_PADDING[density];

  if (removed) {
    return (
      <div className={`flex items-center gap-2.5 ${padding}`}>
        <Icon className="h-4 w-4 flex-none text-muted-foreground/50" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted-foreground line-through">{item.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {t('removedLabel', locale)}
            {removed.reason ? `: ${removed.reason}` : ''}
          </div>
        </div>
        {actions}
      </div>
    );
  }

  const body = (
    <>
      <Icon className="h-4 w-4 flex-none text-muted-foreground/70" aria-hidden />
      <span className={`min-w-0 flex-1 ${TITLE_FIT[density]} text-sm font-medium text-foreground`}>{item.title}</span>
      {item.kind === 'file' && item.file && (
        <span className="flex-none text-xs text-muted-foreground">{formatSize(item.file.size_bytes, locale)}</span>
      )}
      {item.hidden_until_end && (
        <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          {t('afterClassChip', locale)}
        </span>
      )}
    </>
  );

  let target: ReactNode;
  if (item.kind === 'link') {
    const href = safeLinkHref(item);
    target = href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          openClassMaterialItem(item.id).catch(() => undefined);
        }}
        className={OPEN_TARGET_CLASS}
      >
        {body}
      </a>
    ) : (
      <div className="flex min-w-0 flex-1 items-center gap-2.5">{body}</div>
    );
  } else {
    target = (
      <button type="button" onClick={() => onOpen(item)} className={OPEN_TARGET_CLASS}>
        {body}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${padding}`}>
      {target}
      {actions}
    </div>
  );
}
