import { useRef, useState } from 'react';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import LinkDialog from '../class-materials/LinkDialog';
import MyFilesPicker from '../class-materials/MyFilesPicker';
import { apiErrorCode } from '../../services/api/classMaterials';
import { LibraryUploadError, addLibraryItem, libraryErrorText, uploadLibraryFile } from '../../services/api/library';
import { errorMessage, t, type Locale } from '../../lib/classMaterials';
import { preCheckLibraryFile } from '../../lib/library';

const FILE_INPUT_ACCEPT = '.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*,.heic,.heif,.mp3,.m4a';

interface Props {
  sectionId: number;
  locale: Locale;
  onChanged: () => void;
}

interface Entry {
  key: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  uploadId?: string | null;
  controller?: AbortController;
}

/**
 * «Добавить» in a library section (SPEC §6, §9): upload files (chunked and resumable — a failed or
 * cancelled one keeps its server session, so «Повторить» picks up where it stopped), «Из моих
 * файлов» and «Ссылка». Files go one at a time: books are big, and a phone uplink shared between
 * three 150 MB uploads finishes none of them sooner.
 */
export default function LibraryAddMenu({ sectionId, locale, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [myFilesOpen, setMyFilesOpen] = useState(false);
  const running = useRef(false);
  const queue = useRef<Entry[]>([]);

  const patch = (key: string, next: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...next } : e)));

  const runOne = async (entry: Entry) => {
    const controller = new AbortController();
    patch(entry.key, { status: 'uploading', error: undefined, controller });
    try {
      const classFile = await uploadLibraryFile(entry.file, {
        signal: controller.signal,
        resumeId: entry.uploadId,
        onProgress: (progress) => patch(entry.key, { progress }),
      });
      try {
        await addLibraryItem(sectionId, { file_id: classFile.id });
      } catch (err) {
        if (apiErrorCode(err) !== 'duplicate') throw err; // already in this section: nothing to add
      }
      patch(entry.key, { status: 'done', progress: 100, controller: undefined, uploadId: null });
      onChanged();
    } catch (err) {
      if (err instanceof LibraryUploadError) {
        const error = err.cancelled ? t('uploadCancelled', locale) : err.reason;
        patch(entry.key, { status: 'error', error, uploadId: err.uploadId, controller: undefined });
      } else {
        // The file reached the shelf but the attach failed: «Из моих файлов» can still add it.
        patch(entry.key, { status: 'error', error: libraryErrorText(err, locale), controller: undefined });
      }
    }
  };

  const drain = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const next = queue.current.shift() as Entry;
        await runOne(next);
      }
    } finally {
      running.current = false;
    }
  };

  const enqueue = (items: Entry[]) => {
    queue.current.push(...items);
    void drain();
  };

  const addFiles = (files: File[]) => {
    const fresh: Entry[] = files.map((file, i) => {
      const rejection = preCheckLibraryFile(file);
      const key = `${Date.now()}-${i}-${file.name}`;
      return rejection
        ? { key, file, status: 'error', progress: 0, error: errorMessage(rejection, locale) }
        : { key, file, status: 'pending', progress: 0 };
    });
    setEntries((prev) => [...prev.filter((e) => e.status !== 'done'), ...fresh]);
    enqueue(fresh.filter((e) => e.status === 'pending'));
  };

  const retry = (entry: Entry) => {
    patch(entry.key, { status: 'pending', error: undefined });
    enqueue([{ ...entry, status: 'pending' }]);
  };

  const settled = entries.every((e) => e.status === 'done' || e.status === 'error');

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-11 gap-1.5 sm:h-9">
            <Plus className="h-4 w-4" aria-hidden />
            {t('add', locale)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>{t('uploadFiles', locale)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMyFilesOpen(true)}>{t('fromMyFiles', locale)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLinkOpen(true)}>{t('link', locale)}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) addFiles(files);
        }}
      />

      {entries.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-2">
          {entries.map((entry) => (
            <div key={entry.key} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-foreground">{entry.file.name}</span>
                {entry.status === 'uploading' && (
                  <button
                    type="button"
                    onClick={() => entry.controller?.abort()}
                    className="flex h-8 flex-none items-center gap-1 rounded px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {t('cancel', locale)}
                  </button>
                )}
                {entry.status === 'error' && preCheckLibraryFile(entry.file) === null && (
                  <button
                    type="button"
                    onClick={() => retry(entry)}
                    className="flex h-8 flex-none items-center gap-1 rounded px-2 font-medium text-primary hover:bg-muted"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    {t('retry', locale)}
                  </button>
                )}
                {entry.status === 'done' && <Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400" aria-label={t('uploaded', locale)} />}
              </div>
              {entry.status === 'error' && entry.error && <p className="break-words text-xs text-destructive">{entry.error}</p>}
              {(entry.status === 'pending' || entry.status === 'uploading') && <Progress value={entry.progress} className="h-1.5" />}
            </div>
          ))}
          {settled && (
            <button
              type="button"
              onClick={() => setEntries([])}
              className="flex h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              {t('close', locale)}
            </button>
          )}
        </div>
      )}

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        locale={locale}
        onSubmit={async (link) => {
          await addLibraryItem(sectionId, { url: link.url, link_title: link.title });
          onChanged();
        }}
      />
      <MyFilesPicker
        open={myFilesOpen}
        onOpenChange={setMyFilesOpen}
        locale={locale}
        onConfirm={async (fileIds) => {
          let skipped = 0;
          for (const fileId of fileIds) {
            try {
              await addLibraryItem(sectionId, { file_id: fileId });
            } catch (err) {
              if (apiErrorCode(err) !== 'duplicate') throw err;
              skipped += 1;
            }
          }
          if (skipped) toast(t('alreadyInSection', locale));
          onChanged();
        }}
      />
    </div>
  );
}
