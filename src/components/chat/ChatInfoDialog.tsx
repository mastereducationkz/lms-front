import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Bell, BellOff } from 'lucide-react';
import { getSharedMedia } from '../../services/api';
import { safeUploadUrl } from '../../lib/mediaUrl';

interface SharedMediaItem {
  id: number;
  file_url: string;
  from_user_id: number;
  created_at: string | null;
}

interface ChatInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number | null;
  name: string;
  role?: string;
  avatarUrl?: string;
  isMuted: boolean;
  onToggleMute: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

/** `fileUrl` is another user's stored file reference, unvalidated server-side today —
 *  resolve it through the safe helper rather than loading whatever it says. */
function resolveUrl(fileUrl: string): string | null {
  return safeUploadUrl(fileUrl);
}

/** Chat/contact info panel: participant details, shared media/files, mute toggle. */
export function ChatInfoDialog({
  open, onOpenChange, partnerId, name, role, avatarUrl, isMuted, onToggleMute,
}: ChatInfoDialogProps) {
  const [media, setMedia] = useState<SharedMediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !partnerId) return;
    let active = true;
    setLoading(true);
    getSharedMedia(partnerId)
      .then((items) => { if (active) setMedia(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, partnerId]);

  const images = media.filter((m) => isImage(m.file_url));
  const files = media.filter((m) => !isImage(m.file_url));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chat info</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center py-2">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <p className="mt-3 text-lg font-semibold">{name}</p>
          {role && <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{role}</p>}
        </div>

        <Button
          variant={isMuted ? 'default' : 'outline'}
          onClick={onToggleMute}
          className="w-full justify-center gap-2"
        >
          {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isMuted ? 'Unmute notifications' : 'Mute notifications'}
        </Button>

        <div className="mt-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Shared media &amp; files
          </p>
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          ) : media.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No shared media yet</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-3">
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((m) => {
                    const href = resolveUrl(m.file_url);
                    if (!href) return null;
                    return (
                      <a key={m.id} href={href} target="_blank" rel="noreferrer">
                        <img
                          src={href}
                          alt="shared"
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      </a>
                    );
                  })}
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((m) => {
                    // Stored keys keep the raw upload filename, so a literal '%' is not a valid
                    // escape and decodeURIComponent throws URIError here — same guard as
                    // ChatAttachment, so one bad shared-media row can't take the dialog down.
                    const rawName = m.file_url.split('/').pop() || 'file';
                    const fileName = (() => {
                      try {
                        return decodeURIComponent(rawName);
                      } catch {
                        return rawName;
                      }
                    })();
                    const href = resolveUrl(m.file_url);
                    if (!href) {
                      return (
                        <p key={m.id} className="text-sm text-gray-400 break-all">
                          📎 {fileName} (unavailable)
                        </p>
                      );
                    }
                    return (
                      <a
                        key={m.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-blue-600 dark:text-blue-400 underline break-all"
                      >
                        📎 {fileName}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
