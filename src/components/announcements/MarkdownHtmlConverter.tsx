import { Clipboard, Download, FileCode2, Sparkles } from 'lucide-react';
import { useMemo, useState, type ClipboardEvent } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from '../Toast';
import { copyAnnouncementHtml } from './announcementClipboard';
import { downloadableHtml, markdownToTelegramHtml, richHtmlToTelegramHtml } from './markdownToHtml';
import { renderPreviewHtml } from './telegramText';

interface MarkdownHtmlConverterProps {
  onUse: (html: string) => void;
}

export function MarkdownHtmlConverter({ onUse }: MarkdownHtmlConverterProps) {
  const [source, setSource] = useState('');
  const [richHtml, setRichHtml] = useState<string | null>(null);
  const html = useMemo(() => richHtml ?? markdownToTelegramHtml(source), [richHtml, source]);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const converted = richHtmlToTelegramHtml(event.clipboardData.getData('text/html'));
    if (!converted) return;
    event.preventDefault();
    setSource(event.clipboardData.getData('text/plain') || converted);
    setRichHtml(converted);
    toast('Rich formatting detected and converted', 'success');
  };

  const copy = async () => {
    if (!html) return;
    try {
      await copyAnnouncementHtml(html);
      toast('HTML copied to clipboard', 'success');
    } catch {
      toast('Could not access the clipboard', 'error');
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
          Paste formatted text
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste rich text or Markdown like <code>**bold**</code>, <code>[link](https://...)</code> or <code>`code`</code>.
          The formatter preserves rich clipboard formatting when available.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="markdown-source">Formatted text</Label>
          <p className="text-xs text-muted-foreground">
            Links are preserved only when you paste the rich link itself. If you only have visible
            link text, add the URL with the Link button or use <code>[text](https://...)</code>.
          </p>
          <Textarea
            id="markdown-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setRichHtml(null);
            }}
            onPaste={handlePaste}
            placeholder="📢 **SAT 2026**\n\nВаш текст здесь..."
            className="min-h-[180px] text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="min-h-[180px] whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono">
            {html ? <span dangerouslySetInnerHTML={{ __html: renderPreviewHtml(html) }} /> : <span className="text-muted-foreground">Nothing to preview yet.</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="button" onClick={() => onUse(html)} disabled={!html}>
            <Sparkles className="mr-2 h-4 w-4" />
            Use in message
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy()} disabled={!html}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copy HTML
          </Button>
          <Button type="button" variant="outline" onClick={download} disabled={!html}>
            <Download className="mr-2 h-4 w-4" />
            Download .html
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
