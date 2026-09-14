import { useRef, useState } from 'react';
import { AlertTriangle, Upload, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from '../Toast';
import { directoryAgeHours } from '../../lib/workspaceRollout';
import { uploadWorkspaceDirectory, type WorkspaceDirectory } from '../../services/api/recordingsAdmin';

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
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const age = directoryAgeHours(directory?.uploaded_at ?? null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadWorkspaceDirectory(await file.text());
      toast(`Users list uploaded: ${result.count} Workspace accounts`, 'success');
      onUploaded();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to upload the users list', 'error');
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
              Workspace users list: <strong>{directory.count}</strong> accounts, uploaded{' '}
              {new Date(directory.uploaded_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
              {directory.uploaded_by ? ` by ${directory.uploaded_by}` : ''}
            </div>
            {age !== null && age > STALE_HOURS && (
              <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Over {Math.floor(age)} hours old — accounts created since then show as new. Upload a fresh list.
              </div>
            )}
          </div>
        ) : (
          <div className="text-foreground">
            <strong>No Workspace users list uploaded yet.</strong>{' '}
            <span className="text-muted-foreground">
              Until it is, the page cannot tell existing accounts from new ones, so nothing can be
              connected or imported.
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
            {uploading ? 'Uploading…' : directory?.uploaded_at ? 'Upload a fresh list' : 'Upload users list'}
          </Button>
        </div>
      )}
    </div>
  );
}
