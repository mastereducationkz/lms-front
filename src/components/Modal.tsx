
import { createPortal } from 'react-dom';

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
  if (!open) return null;
  const content = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border w-full max-w-lg p-6">
        <div className="text-lg font-semibold mb-4">{title}</div>
        <div className="space-y-4 max-h-[70vh] overflow-auto">{children}</div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onCancel || onClose} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80">{cancelText}</button>
          <button onClick={onSubmit} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{submitText}</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}


