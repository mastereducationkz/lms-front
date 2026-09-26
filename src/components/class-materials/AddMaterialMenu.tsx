import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import {
  apiErrorCode, attachClassMaterials, uploadClassFile, type ClassFile, type LessonMaterials,
} from '../../services/api/classMaterials';
import { errorMessage, fileExt, isOfficeExt, preCheckFile, t, type Locale } from '../../lib/classMaterials';
import { UploadFailedError } from '../../lib/uploadFailure';
import { runWithConcurrency } from '../../lib/uploadQueue';
import UploadQueue, { type UploadQueueItem } from './UploadQueue';
import LinkDialog from './LinkDialog';
import MyFilesPicker from './MyFilesPicker';
import CopyFromLessonPicker from './CopyFromLessonPicker';

const UPLOAD_CONCURRENCY = 3;
const FILE_INPUT_ACCEPT =
  '.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*,.heic,.heif,.mp3,.m4a';

export interface AddMaterialMenuHandle {
  /** Lets `ClassMaterialsSection` feed in files dropped on the section itself (§8.1). */
  addFiles: (files: File[]) => void;
}

interface Props {
  eventId: number;
  locale: Locale;
  onMutated: (updated?: LessonMaterials) => void;
}

interface QueueEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  classFile?: ClassFile;
}

/**
 * The lesson pop-up's «Добавить ▾» menu (§8.1): upload (with drag-and-drop via the imperative
 * `addFiles`), «Из моих файлов», «Скопировать из урока…» and «Ссылка». Every successful attach
 * hands the caller the full `LessonMaterials` response through `onMutated` so the section can
 * update without a second round trip.
 *
 * One upload batch at a time: from the first file until the batch is attached, the menu is
 * disabled and dropped files are ignored, so a second batch can never overwrite the queue of
 * one still running.
 */
const AddMaterialMenu = forwardRef<AddMaterialMenuHandle, Props>(function AddMaterialMenu(
  { eventId, locale, onMutated },
  ref,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [officeNudge, setOfficeNudge] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [myFilesOpen, setMyFilesOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  // The guard itself: `addFiles` can run from a drop before the disabled state re-renders.
  const inFlightRef = useRef(false);

  const runUploads = async (uploadable: { entry: QueueEntry; index: number }[]) => {
    const succeeded: { file: File; classFile: ClassFile }[] = [];

    await runWithConcurrency(uploadable, UPLOAD_CONCURRENCY, async ({ entry, index }) => {
      setQueue((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'uploading' } : e)));
      try {
        const classFile = await uploadClassFile(entry.file, (pct) => {
          setQueue((prev) => prev.map((e, i) => (i === index ? { ...e, progress: pct } : e)));
        });
        succeeded.push({ file: entry.file, classFile });
        setQueue((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'done', progress: 100, classFile } : e)));
      } catch (err) {
        const message = err instanceof UploadFailedError ? err.reason : errorMessage(undefined, locale);
        setQueue((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'error', error: message } : e)));
      }
    });

    if (!succeeded.length) return;
    if (succeeded.some(({ file }) => isOfficeExt(fileExt(file.name)))) setOfficeNudge(true);

    try {
      const res = await attachClassMaterials(eventId, { file_ids: succeeded.map((s) => s.classFile.id) });
      if (res.skipped > 0) toast(t('duplicate', locale));
      onMutated(res);
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    }
  };

  const startUpload = (files: File[]) => {
    if (!files.length || inFlightRef.current) return;
    const entries: QueueEntry[] = files.map((file) => {
      const rejection = preCheckFile(file);
      return rejection
        ? { file, status: 'error' as const, progress: 0, error: errorMessage(rejection, locale) }
        : { file, status: 'pending' as const, progress: 0 };
    });
    setQueue(entries);
    setOfficeNudge(false);

    const uploadable = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.status === 'pending');
    if (!uploadable.length) return;
    inFlightRef.current = true;
    setInFlight(true);
    void runUploads(uploadable).finally(() => {
      inFlightRef.current = false;
      setInFlight(false);
    });
  };

  useImperativeHandle(ref, () => ({ addFiles: startUpload }));

  const queueItems: UploadQueueItem[] = queue.map((entry, index) => ({
    id: `${index}-${entry.file.name}`,
    name: entry.file.name,
    status: entry.status,
    progress: entry.progress,
    error: entry.error,
  }));

  return (
    <>
      {/* Non-modal, with `pointer-events-auto` content: this menu always sits inside a modal
          Dialog, and `@radix-ui/react-menu` 2.1.15 ships its own copy of
          `react-dismissable-layer` (1.1.10, the Dialog's is 1.1.11), so the two don't share a
          layer stack. A modal menu then saves the Dialog's `pointer-events: none` on <body> as
          "original" and puts it back after Escape closes both, freezing the page. Non-modal it
          never touches <body>, and the class keeps its items clickable under the Dialog's
          `none`, which the separate copy doesn't know to override. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="flex-none gap-1 text-primary" disabled={inFlight}>
            {t('add', locale)}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="pointer-events-auto">
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            {t('uploadFiles', locale)}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMyFilesOpen(true)}>{t('fromMyFiles', locale)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCopyOpen(true)}>{t('copyFromLesson', locale)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLinkOpen(true)}>{t('link', locale)}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          startUpload(files);
        }}
      />

      <UploadQueue items={queueItems} locale={locale} onDismiss={queue.length ? () => setQueue([]) : undefined} />
      {officeNudge && <p className="mt-1 w-full text-xs text-muted-foreground">{t('officeNudge', locale)}</p>}

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        locale={locale}
        onSubmit={async (link) => {
          const res = await attachClassMaterials(eventId, { link });
          onMutated(res);
        }}
      />
      <MyFilesPicker
        open={myFilesOpen}
        onOpenChange={setMyFilesOpen}
        locale={locale}
        onConfirm={async (fileIds) => {
          const res = await attachClassMaterials(eventId, { file_ids: fileIds });
          if (res.skipped > 0) toast(t('duplicate', locale));
          onMutated(res);
        }}
      />
      <CopyFromLessonPicker
        open={copyOpen}
        onOpenChange={setCopyOpen}
        eventId={eventId}
        locale={locale}
        onCopied={(res) => onMutated(res.lesson)}
      />
    </>
  );
});

export default AddMaterialMenu;
