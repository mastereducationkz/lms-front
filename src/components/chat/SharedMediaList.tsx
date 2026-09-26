import { ImageOff } from 'lucide-react';
import { fileNameFromUrl, safeUploadUrl } from '../../lib/mediaUrl';

export interface SharedMediaItem {
  id: number;
  file_url: string;
  from_user_id: number;
  created_at: string | null;
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

/**
 * The "Shared media & files" body of `ChatInfoDialog`: an image grid first, then a list
 * of non-image files. Each `file_url` is another user's stored file reference,
 * unvalidated server-side today, so every render goes through `safeUploadUrl` — an
 * unsafe image gets the same neutral tile as a safe one (never just vanishes from the
 * grid), and an unsafe file gets plain, unlinked text.
 *
 * Extracted out of `ChatInfoDialog` so this can be tested without mounting the dialog,
 * which fetches shared media in a `useEffect` a headless render can't run.
 */
export function SharedMediaList({ media }: { media: SharedMediaItem[] }) {
  const images = media.filter((m) => isImage(m.file_url));
  const files = media.filter((m) => !isImage(m.file_url));

  return (
    <div className="max-h-64 overflow-y-auto space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((m) => {
            const href = safeUploadUrl(m.file_url);
            if (!href) {
              return (
                <div
                  key={m.id}
                  className="w-full h-20 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400"
                >
                  <ImageOff className="w-5 h-5" />
                </div>
              );
            }
            return (
              <a key={m.id} href={href} target="_blank" rel="noreferrer">
                <img
                  src={href}
                  alt="shared"
                  className="w-full h-20 object-cover rounded-lg"
                />
              </a>
            );
          })}
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((m) => {
            const fileName = fileNameFromUrl(m.file_url);
            const href = safeUploadUrl(m.file_url);
            if (!href) {
              return (
                <p key={m.id} className="text-sm text-gray-400 break-all">
                  📎 {fileName} (unavailable)
                </p>
              );
            }
            return (
              <a
                key={m.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-blue-600 dark:text-blue-400 underline break-all"
              >
                📎 {fileName}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
