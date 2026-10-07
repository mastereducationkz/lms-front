import { createPortal } from 'react-dom'
import { useId } from 'react'

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitText?: string;
  submitDisabled?: boolean;
  cancelText?: string;
  onCancel?: () => void;
}

export default function Modal({ open, title, children, onClose, onSubmit, submitText = 'Save', submitDisabled = false, cancelText = 'Cancel', onCancel }: ModalProps) {
  const titleId = useId()
  if (!open) return null
  const content = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card p-6 shadow-lg dark:border-border dark:bg-card"
      >
        <div id={titleId} className="shrink-0 text-lg font-semibold">
          {title}
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        <div className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border pt-4 dark:border-border">
          <button type="button" onClick={onCancel || onClose} className="px-4 py-2 rounded-lg bg-muted dark:bg-secondary hover:bg-border dark:hover:bg-secondary/80">
            {cancelText}
          </button>
          <button type="button" onClick={onSubmit} disabled={submitDisabled} className="px-4 py-2 rounded-lg bg-brand-solid text-white hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-50">
            {submitText}
          </button>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}


