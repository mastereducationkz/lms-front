import { X } from 'lucide-react';
import { Progress } from '../ui/progress';
import { t, type Locale } from '../../lib/classMaterials';

export interface UploadQueueItem {
  id: string;
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface Props {
  items: UploadQueueItem[];
  locale: Locale;
  onDismiss?: () => void;
}

/**
 * The «Добавить → Загрузить файлы» progress list (§8.1). A precheck failure (too large, wrong
 * type…) shows its message inline and the file is never sent; the rest show a progress bar
 * while uploading and a check mark once done.
 */
export default function UploadQueue({ items, locale, onDismiss }: Props) {
  if (!items.length) return null;

  return (
    <div className="mt-2 w-full space-y-2 rounded-md border border-border p-2">
      {items.map((item) => (
        <div key={item.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
            {item.status === 'error' && <span className="flex-none text-destructive">{item.error}</span>}
            {item.status === 'done' && <span className="flex-none text-muted-foreground">✓</span>}
          </div>
          {(item.status === 'pending' || item.status === 'uploading') && (
            <Progress value={item.progress} className="h-1.5" />
          )}
        </div>
      ))}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden />
          {t('cancel', locale)}
        </button>
      )}
    </div>
  );
}
