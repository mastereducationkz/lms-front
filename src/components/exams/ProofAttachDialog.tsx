import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { ProofDropzone } from './ProofDropzone';
import { uploadResultProof } from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

interface Props {
  resultId: number;
  /** A proof already exists: this replaces it (the old file is no longer reachable). */
  replacing: boolean;
  title?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Attach a score report to an existing result, or replace the one it has. */
export function ProofAttachDialog({ resultId, replacing, title, onClose, onSaved }: Props) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!file) return;
    setSaving(true); setError(null);
    try {
      await uploadResultProof(resultId, file);
      onSaved();
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('exams.proof.uploadFailed'));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
         role="dialog" aria-modal="true" aria-labelledby="pa-title"
         onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-lg">
        <h2 id="pa-title" className="text-lg font-semibold">
          {replacing ? t('exams.proof.replaceTitle') : t('exams.proof.attachTitle')}
        </h2>
        {title && <p className="mt-0.5 text-sm text-muted-foreground">{title}</p>}
        {replacing && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('exams.proof.replaceWarning')}</p>}
        <div className="mt-3">
          <ProofDropzone file={file} onChange={setFile} disabled={saving} />
        </div>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={save} disabled={!file || saving}>
            {saving ? t('exams.proof.uploading') : t('exams.proof.upload')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
