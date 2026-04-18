import { createPortal } from 'react-dom'
import { useId } from 'react'

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
}

export default function Modal({ open, title, children, onClose, onSubmit, submitText = 'Save', cancelText = 'Cancel', onCancel }: ModalProps) {
  const titleId = useId()
  if (!open) return null
  const content = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-border dark:bg-card"
      >
        <div id={titleId} className="shrink-0 text-lg font-semibold">
          {title}
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        <div className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-border">
          <button type="button" onClick={onCancel || onClose} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80">
            {cancelText}
          </button>
          <button type="button" onClick={onSubmit} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            {submitText}
          </button>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}


