import { Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface SendOptionsProps {
  pin: boolean;
  onPinChange: (next: boolean) => void;
  silent: boolean;
  onSilentChange: (next: boolean) => void;
  /** A `datetime-local` value, or '' to send now. */
  scheduledFor: string;
  onScheduledForChange: (next: string) => void;
}

/** Pin, silent delivery and scheduling. */
export function SendOptions({
  pin,
  onPinChange,
  silent,
  onSilentChange,
  scheduledFor,
  onScheduledForChange,
}: SendOptionsProps) {
  const t = useT();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('announcements.options.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox id="pin" checked={pin} onCheckedChange={(c) => onPinChange(c === true)} />
          <Label htmlFor="pin" className="flex cursor-pointer items-center gap-1.5 text-sm font-normal">
            <Pin className="h-3.5 w-3.5" />
            {t('announcements.options.pin')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="silent" checked={silent} onCheckedChange={(c) => onSilentChange(c === true)} />
          <Label htmlFor="silent" className="cursor-pointer text-sm font-normal">
            {t('announcements.options.silent')}
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('announcements.options.schedule')}</Label>
          <Input
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => onScheduledForChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('announcements.options.scheduleHint')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
