import { useRef, useState } from 'react';
import { AlertTriangle, Upload, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from '../Toast';
import { directoryAgeHours } from '../../lib/workspaceRollout';
import { uploadWorkspaceDirectory, type WorkspaceDirectory } from '../../services/api/recordingsAdmin';
import { formatDateTime } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

/** A list older than this is probably missing accounts created since. */
const STALE_HOURS = 12;

interface Props {
  directory: WorkspaceDirectory | null;
  canWrite: boolean;
  onUploaded: () => void;
}

/**
 * The Workspace users list: the only way the LMS knows which Google accounts exist. Without it
 * nothing can be connected and no import can be built.
 */
export default function DirectoryCard({ directory, canWrite, onUploaded }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const age = directoryAgeHours(directory?.uploaded_at ?? null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadWorkspaceDirectory(await file.text());
      toast(t('adminPages.recordingsRollout.directory.uploaded', { count: result.count }), 'success');
      onUploaded();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('adminPages.recordingsRollout.directory.uploadFailed'), 'error');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
      <div className="flex items-start gap-3 text-sm">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        {directory?.uploaded_at ? (
          <div className="space-y-0.5">
            <div className="text-foreground">
              {t('adminPages.recordingsRollout.directory.label')} <strong>{directory.count}</strong>{' '}
              {t('adminPages.recordingsRollout.directory.accountsUploaded', {
                count: directory.count,
                date: formatDateTime(directory.uploaded_at, {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }),
              })}
              {directory.uploaded_by ? ` ${t('adminPages.recordingsRollout.directory.uploadedBy', { name: directory.uploaded_by })}` : ''}
            </div>
            {age !== null && age > STALE_HOURS && (
              <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {t('adminPages.recordingsRollout.directory.stale', { count: Math.floor(age) })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-foreground">
            <strong>{t('adminPages.recordingsRollout.directory.none')}</strong>{' '}
            <span className="text-muted-foreground">
              {t('adminPages.recordingsRollout.directory.noneHint')}
            </span>
          </div>
        )}
      </div>
      {canWrite && (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground lg:inline">
            Google Admin → Directory → Users → Download users → CSV
          </span>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? t('adminPages.recordingsRollout.directory.uploading') : directory?.uploaded_at ? t('adminPages.recordingsRollout.directory.uploadFresh') : t('adminPages.recordingsRollout.directory.upload')}
          </Button>
        </div>
      )}
    </div>
  );
}
