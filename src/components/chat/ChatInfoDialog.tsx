import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Bell, BellOff } from 'lucide-react';
import { getSharedMedia } from '../../services/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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

function resolveUrl(fileUrl: string) {
  return fileUrl.startsWith('http') ? fileUrl : `${BACKEND_URL}${fileUrl}`;
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
                  {images.map((m) => (
                    <a key={m.id} href={resolveUrl(m.file_url)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveUrl(m.file_url)}
                        alt="shared"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                    </a>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((m) => {
                    const fileName = decodeURIComponent(m.file_url.split('/').pop() || 'file');
                    return (
                      <a
                        key={m.id}
                        href={resolveUrl(m.file_url)}
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
