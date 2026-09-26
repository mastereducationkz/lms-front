import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Bell, BellOff } from 'lucide-react';
import { getSharedMedia } from '../../services/api';
import { SharedMediaList, type SharedMediaItem } from './SharedMediaList';

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
            <SharedMediaList media={media} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
