import { Clipboard, Download, FileCode2, Sparkles } from 'lucide-react';
import { sanitizeHtml } from '../../lib/safeHtml';
import { useMemo, useState, type ClipboardEvent } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from '../Toast';
import { useT } from '../../lib/i18n/react';
import { copyAnnouncementHtml } from './announcementClipboard';
import { downloadableHtml, markdownToTelegramHtml, richHtmlToTelegramHtml } from './markdownToHtml';
import { renderPreviewHtml } from './telegramText';
import '@/lib/i18n/catalogs/announcements';

interface MarkdownHtmlConverterProps {
  onUse: (html: string) => void;
}

export function MarkdownHtmlConverter({ onUse }: MarkdownHtmlConverterProps) {
  const t = useT();
  const [source, setSource] = useState('');
  const [richHtml, setRichHtml] = useState<string | null>(null);
  const html = useMemo(() => richHtml ?? markdownToTelegramHtml(source), [richHtml, source]);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const converted = richHtmlToTelegramHtml(event.clipboardData.getData('text/html'));
    if (!converted) return;
    event.preventDefault();
    setSource(event.clipboardData.getData('text/plain') || converted);
    setRichHtml(converted);
    toast(t('announcements.converter.richConverted'), 'success');
  };

  const copy = async () => {
    if (!html) return;
    try {
      await copyAnnouncementHtml(html);
      toast(t('announcements.converter.htmlCopied'), 'success');
    } catch {
      toast(t('announcements.converter.clipboardFailed'), 'error');
    }
  };

  const download = () => {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([downloadableHtml(html)], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'announcement.html';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCode2 className="h-4 w-4" />
          {t('announcements.converter.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('announcements.converter.introExamples')} <code>{t('announcements.converter.exampleBold')}</code>,{' '}
          <code>{t('announcements.converter.exampleLink')}</code>, <code>{t('announcements.converter.exampleCode')}</code>.{' '}
          {t('announcements.converter.introRich')}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="markdown-source">{t('announcements.converter.sourceLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('announcements.converter.linksHint')} <code>{t('announcements.converter.exampleTextLink')}</code>.
          </p>
          <Textarea
            id="markdown-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setRichHtml(null);
            }}
            onPaste={handlePaste}
            placeholder={t('announcements.converter.placeholder')}
            className="min-h-[180px] text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('announcements.editor.preview')}</Label>
          <div className="min-h-[180px] whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono">
            {html ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(html)) }} /> : <span className="text-muted-foreground">{t('announcements.editor.nothingToPreview')}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="button" onClick={() => onUse(html)} disabled={!html}>
            <Sparkles className="mr-2 h-4 w-4" />
            {t('announcements.converter.useInMessage')}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy()} disabled={!html}>
            <Clipboard className="mr-2 h-4 w-4" />
            {t('announcements.converter.copyHtml')}
          </Button>
          <Button type="button" variant="outline" onClick={download} disabled={!html}>
            <Download className="mr-2 h-4 w-4" />
            {t('announcements.converter.downloadHtml')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
