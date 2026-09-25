import type { ReactNode } from 'react';
import { FileText, Image as ImageIcon, Link2, Music, Presentation } from 'lucide-react';
import type { MaterialItem } from '../../services/api/classMaterials';
import { formatSize, t, type Locale } from '../../lib/classMaterials';
import { materialIconKind } from '../../lib/classMaterialsView';

interface Props {
  item: MaterialItem;
  locale: Locale;
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

/**
 * One row of `ClassMaterialsSection`: a kind icon, the title, its size (files only) and the
 * «after class» chip when the teacher gated it. A moderated item renders as a greyed-out
 * audit line — the reason instead of an open action — since only a moderator ever sees one
 * at all (the backend already leaves them out of everyone else's response).
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

  return (
    <div className={`flex items-center gap-2.5 ${padding}`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4 flex-none text-muted-foreground/70" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.title}</span>
        {item.kind === 'file' && item.file && (
          <span className="flex-none text-xs text-muted-foreground">{formatSize(item.file.size_bytes, locale)}</span>
        )}
        {item.hidden_until_end && (
          <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            {t('afterClassChip', locale)}
          </span>
        )}
      </button>
      {actions}
    </div>
  );
}
