import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from '../Toast';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface TestSendCardProps {
  testing: boolean;
  /** Deliver the current composition to this one chat. */
  onTestSend: (chatId: number) => void;
}

/**
 * Send the exact message to one chat — the staff test group — before anything
 * is created. Nothing is recorded, which is also why it can't be recalled.
 */
export function TestSendCard({ testing, onTestSend }: TestSendCardProps) {
  const t = useT();
  const [chatId, setChatId] = useState('');

  const submit = () => {
    const parsed = Number(chatId);
    // Group ids are negative (-100…), so this must be a real number check, not
    // a digits-only one.
    if (!chatId.trim() || !Number.isInteger(parsed)) {
      toast(t('announcements.testSend.needChatId'), 'error');
      return;
    }
    onTestSend(parsed);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('announcements.testSend.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('announcements.testSend.hint')}
        </p>
        <Input
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          // No inputMode="numeric": iOS's numeric keypad has no minus key, and
          // every group chat id is negative.
          placeholder={t('announcements.testSend.placeholder')}
        />
        <Button variant="outline" className="w-full" onClick={submit} disabled={testing}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {t('announcements.testSend.button')}
        </Button>
      </CardContent>
    </Card>
  );
}
