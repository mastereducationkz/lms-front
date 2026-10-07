import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Bell, BellOff } from 'lucide-react';
import { getSharedMedia } from '../../services/api';
import { SharedMediaList, type SharedMediaItem } from './SharedMediaList';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';

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
  const t = useT();
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
          <DialogTitle>{t('chatLive.chat.info')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center py-2">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <p className="mt-3 text-lg font-semibold">{name}</p>
          {role && <p className="text-sm text-muted-foreground">{role}</p>}
        </div>

        <Button
          variant={isMuted ? 'default' : 'outline'}
          onClick={onToggleMute}
          className="w-full justify-center gap-2"
        >
          {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isMuted ? t('chatLive.chat.unmute') : t('chatLive.chat.mute')}
        </Button>

        <div className="mt-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
            {t('chatLive.chat.sharedMedia')}
          </p>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-muted-foreground py-4 text-center">{t('common.loading')}</p>
          ) : media.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-muted-foreground py-4 text-center">{t('chatLive.chat.noSharedMedia')}</p>
          ) : (
            <SharedMediaList media={media} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
