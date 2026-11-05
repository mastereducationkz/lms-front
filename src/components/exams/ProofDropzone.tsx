import { useEffect, useId, useRef, useState } from 'react';
import { FileText, ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import { PROOF_ACCEPT, formatBytes, isPdf, proofProblem } from './proofFile';
import '@/lib/i18n/catalogs/exams';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Id for the visible label's `htmlFor`. */
  inputId?: string;
}

/**
 * Drag-and-drop (or click) picker for a score report: JPEG/PNG/GIF/WEBP/PDF up to 10 MB.
 *
 * A rejected file never reaches `onChange`; the reason is shown under the zone and the previous
 * choice stays. An image previews through an object URL that is released on replace/unmount; a PDF
 * is a file card (name and size) with an optional inline preview through a blob iframe.
 */
export function ProofDropzone({ file, onChange, disabled, inputId }: Props) {
  const t = useT();
  const autoId = useId();
  const id = inputId ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setUrl(null); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => { setShowPdf(false); }, [file]);

  const accept = (picked: File | undefined) => {
    if (!picked) return;
    const bad = proofProblem(picked);
    if (bad) {
      setProblem(t(`exams.proof.error.${bad}`));
      return;
    }
    setProblem(null);
    onChange(picked);
  };

  const pdf = file ? isPdf(file) : false;

  return (
    <div>
      {!file ? (
        <label
          htmlFor={id}
          data-testid="proof-dropzone"
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) accept(e.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed px-3 py-4 text-center text-xs transition-colors
            ${over ? 'border-primary bg-brand-subtle' : 'border-input bg-muted/30 hover:bg-muted/50'}
            ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{t('exams.proof.drop')}</span>
          <span className="text-[11px] text-muted-foreground">{t('exams.proof.formats')}</span>
        </label>
      ) : (
        <div className="rounded-md border bg-muted/30 p-2" data-testid="proof-selected">
          <div className="flex items-center gap-2">
            {pdf
              ? <FileText className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
              : url
                ? <img src={url} alt={t('exams.proof.previewAlt')} className="h-16 w-16 shrink-0 rounded object-cover" />
                : <ImageIcon className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              {pdf && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowPdf((v) => !v)}>
                  {showPdf ? t('exams.proof.hidePreview') : t('exams.proof.showPreview')}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" disabled={disabled}
                      onClick={() => inputRef.current?.click()}>
                {t('exams.proof.replace')}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled}
                      aria-label={t('exams.proof.remove')} title={t('exams.proof.remove')}
                      onClick={() => { setProblem(null); onChange(null); }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {pdf && showPdf && url && (
            <iframe src={url} title={file.name} className="mt-2 h-72 w-full rounded border bg-background" />
          )}
        </div>
      )}
      <input
        id={id} ref={inputRef} type="file" accept={PROOF_ACCEPT} disabled={disabled}
        className="sr-only"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }}
      />
      {problem && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{problem}</p>}
    </div>
  );
}
