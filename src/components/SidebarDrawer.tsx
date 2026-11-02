import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * A page's side column as a drawer on phones (< md). The page keeps the column in a
 * `hidden md:block` wrapper for tablets and desktop, puts a `md:hidden` button wired with
 * `toggleProps` in its header, and renders the same column inside <SidebarDrawer>.
 * Used by the lesson editor and the course builder; the lesson player has its own copy.
 */

const MD_QUERY = '(min-width: 768px)';

export function useSidebarDrawer(id: string) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return {
    open,
    close,
    toggleProps: {
      'aria-expanded': open,
      'aria-controls': open ? id : undefined,
      'aria-haspopup': 'dialog' as const,
      onClick: () => setOpen((o) => !o),
    },
    drawerProps: { id, open, onClose: close },
  };
}

interface SidebarDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Heading of the drawer and the accessible name of its dialog. */
  label: string;
  closeLabel: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SidebarDrawer({ id, open, onClose, label, closeLabel, children }: SidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline closures; keep the effect below from re-running (and re-focusing) on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      // A layer opened from inside the drawer (a select, a confirm dialog) closes itself first.
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      // Keep Tab inside the drawer while it is open.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // The drawer is phone-only: if the window grows past md the side column is back, close it.
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(MD_QUERY) : null;
    const onWide = () => { if (mq?.matches) onCloseRef.current(); };
    mq?.addEventListener?.('change', onWide);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      mq?.removeEventListener?.('change', onWide);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40" data-testid="sidebar-drawer">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} data-testid="sidebar-drawer-overlay" />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-background border-r shadow-xl outline-none motion-safe:animate-in motion-safe:slide-in-from-left motion-safe:duration-200"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
          <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
