import { useState } from 'react';
import { FileText, Paperclip, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { ProofAttachDialog } from './ProofAttachDialog';
import { ProofPreviewDialog } from './ProofPreviewDialog';
import { ResultStatusChip, type ChipResult } from './ResultStatusChip';
import { updateExamResult } from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

export interface ProofCellResult extends ChipResult {
  id: number;
}

interface Props {
  result: ProofCellResult;
  canWrite: boolean;
  /** Names the dialogs ("Anna Petrova"). */
  label?: string;
  /** Something changed on the server (proof attached, result confirmed): refetch. */
  onChanged: () => void;
  onError: (message: string) => void;
}

/**
 * Everything a curator does with one result's evidence, in one cell: its status chip and the
 * «без подтверждения» flag, an in-app preview of the proof, attach/replace, and «Подтвердить».
 * Readers (teachers) get the chip and the preview only.
 */
export function ResultProofCell({ result, canWrite, label, onChanged, onError }: Props) {
  const t = useT();
  const [previewing, setPreviewing] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      await updateExamResult(result.id, { status: 'verified' });
      onChanged();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      onError(typeof detail === 'string' ? detail : t('exams.errors.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <ResultStatusChip result={result} />
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        {result.has_proof && (
          <button type="button" onClick={() => setPreviewing(true)} aria-haspopup="dialog"
                  aria-label={t('exams.row.openProof')}
                  className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t('exams.row.view')}
          </button>
        )}
        {canWrite && (
          <button type="button" onClick={() => setAttaching(true)} aria-haspopup="dialog"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            {result.has_proof ? t('exams.proof.replace') : t('exams.proof.attach')}
          </button>
        )}
      </div>
      {canWrite && result.status === 'reported' && (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={verifying} onClick={verify}>
          <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('exams.status.verify')}
        </Button>
      )}
      {previewing && (
        <ProofPreviewDialog resultId={result.id} title={label} onClose={() => setPreviewing(false)}
                            onReplace={canWrite ? () => { setPreviewing(false); setAttaching(true); } : undefined} />
      )}
      {attaching && (
        <ProofAttachDialog resultId={result.id} replacing={result.has_proof} title={label}
                           onClose={() => setAttaching(false)} onSaved={onChanged} />
      )}
    </div>
  );
}
