import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { formatDate, type MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

interface UpdateItem {
  title: MessageKey;
  description: MessageKey;
  type: 'new' | 'improvement' | 'fix';
}

interface UpdateRelease {
  version: string;
  /** YYYY-MM-DD, shown in the reader's language. */
  date: string;
  title: MessageKey;
  updates: UpdateItem[];
}

const RELEASE_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

// Platform updates changelog - add new releases at the top
const RELEASES: UpdateRelease[] = [
  {
    version: '2026.01.04',
    date: '2026-01-04',
    title: 'studentHome.updates.r20260104.title',
    updates: [
      {
        title: 'studentHome.updates.r20260104.fileText.title',
        description: 'studentHome.updates.r20260104.fileText.description',
        type: 'new',
      },
      {
        title: 'studentHome.updates.r20260104.fileTypes.title',
        description: 'studentHome.updates.r20260104.fileTypes.description',
        type: 'improvement',
      },
      {
        title: 'studentHome.updates.r20260104.keywords.title',
        description: 'studentHome.updates.r20260104.keywords.description',
        type: 'new',
      },
    ],
  },
  // Add more releases here as needed
];

const TYPE_LABEL: Record<UpdateItem['type'], MessageKey> = {
  new: 'studentHome.updates.type.new',
  improvement: 'studentHome.updates.type.improvement',
  fix: 'studentHome.updates.type.fix',
};

interface PlatformUpdatesModalProps {
  /** If true, always show the modal (for manual trigger) */
  forceOpen?: boolean;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Only show to these roles */
  userRole?: string;
}

export default function PlatformUpdatesModal({ 
  forceOpen = false, 
  onClose,
  userRole 
}: PlatformUpdatesModalProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<UpdateRelease | null>(RELEASES[0] || null);

  useEffect(() => {
    // Only show to teachers and admins
    if (userRole && !['teacher', 'admin'].includes(userRole)) {
      return;
    }

    // Only open if forceOpen is true (button clicked)
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen, userRole]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  if (RELEASES.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('studentHome.updates.title')}</DialogTitle>
          <DialogDescription>
            {t('studentHome.updates.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* Version list sidebar */}
          {RELEASES.length > 1 && (
            <div className="w-48 border-r pr-4 overflow-y-auto flex-shrink-0">
              <div className="space-y-1">
                {RELEASES.map((release) => (
                  <button
                    key={release.version}
                    onClick={() => setSelectedRelease(release)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedRelease?.version === release.version
                        ? 'bg-brand-surface text-brand-subtle-foreground border border-brand-border'
                        : 'hover:bg-muted text-gray-700 dark:text-foreground'
                    }`}
                  >
                    <div className="text-sm font-medium">{release.version}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(release.date, RELEASE_DATE)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Updates content */}
          <div className="flex-1 overflow-y-auto">
            {selectedRelease && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t(selectedRelease.title)}
                  </h3>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedRelease.date, RELEASE_DATE)}</p>
                </div>

                <div className="space-y-3">
                  {selectedRelease.updates.map((update, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {t(update.title)}
                        </span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                          {t(TYPE_LABEL[update.type])}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(update.description)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>


        <DialogFooter className="border-t pt-4 mt-4">
          <Button onClick={handleClose}>
            {t('studentHome.updates.gotIt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export a button component to manually trigger the modal
export function WhatsNewButton({ userRole }: { userRole?: string }) {
  const t = useT();
  const [showModal, setShowModal] = useState(false);

  // Only show to teachers and admins
  if (userRole && !['teacher', 'admin'].includes(userRole)) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        className="font-medium border-gray-300 dark:border-input hover:border-gray-400 text-gray-700 dark:text-foreground hover:text-foreground"
      >
        {t('studentHome.updates.title')}
      </Button>
      
      {showModal && (
        <PlatformUpdatesModal
          forceOpen={true}
          onClose={() => setShowModal(false)}
          userRole={userRole}
        />
      )}
    </>
  );
}
