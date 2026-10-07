import { useEffect, useMemo } from 'react';
import { ChevronLeft, ImagePlus, X } from 'lucide-react';
import { Label } from '../ui/label';
import { toast } from '../Toast';
import { MAX_IMAGES } from './telegramText';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface ImagePickerProps {
  images: File[];
  onChange: (next: File[]) => void;
}

/**
 * Up to ten photos, in the order they will appear in the album. Order matters:
 * Telegram shows an album's caption beneath its FIRST photo, so staff reorder
 * to choose which image leads.
 */
export function ImagePicker({ images, onChange }: ImagePickerProps) {
  const t = useT();
  // Object URLs must be revoked or every re-pick leaks one.
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const add = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast(t('announcements.images.albumFull', { max: MAX_IMAGES }), 'error');
      return;
    }
    if (picked.length > room) {
      toast(t('announcements.images.onlyMore', { count: room }), 'info');
    }
    onChange([...images, ...picked.slice(0, room)]);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const moveButtonClass =
    'rounded p-0.5 text-muted-foreground disabled:opacity-30 hover:bg-accent';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          {t('announcements.images.label', { count: images.length, max: MAX_IMAGES })}
        </Label>
        <label className="inline-flex">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              add(event.target.files);
              // Reset so re-picking the same file still fires onChange.
              event.target.value = '';
            }}
          />
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <ImagePlus className="h-4 w-4" />
            {t('announcements.images.add')}
          </span>
        </label>
      </div>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative">
              <img
                src={previews[index]}
                alt={file.name}
                className="h-24 w-24 rounded-md border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white"
                aria-label={t('announcements.images.remove', { name: file.name })}
              >
                <X className="h-3 w-3" />
              </button>
              <div className="mt-1 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className={moveButtonClass}
                  aria-label={t('announcements.images.moveEarlier')}
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  className={`${moveButtonClass} rotate-180`}
                  aria-label={t('announcements.images.moveLater')}
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
