import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { FormatToolbar, insertLink, wrapSelection } from './FormatToolbar';
import { ImagePicker } from './ImagePicker';
import { MarkdownHtmlConverter } from './MarkdownHtmlConverter';
import {
  CAPTION_LIMIT,
  TEXT_LIMIT,
  renderPreviewHtml,
  visibleLength,
  visibleText,
} from './telegramText';

interface MessageEditorProps {
  body: string;
  onBodyChange: (next: string) => void;
  images: File[];
  onImagesChange: (next: File[]) => void;
}

/** Keyboard shortcuts that wrap the selection in a tag. */
const SHORTCUT_TAGS: Record<string, string> = { b: 'b', i: 'i', u: 'u' };

/** The Message card: formatting toolbar, body, live preview and photos. */
export function MessageEditor({ body, onBodyChange, images, onImagesChange }: MessageEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Telegram caps a photo caption at 1024 characters but a standalone message
   * at 4096. With images attached, a longer body is sent as a second message
   * rather than truncated — worth saying out loud, because the composer would
   * otherwise look like it was silently ignoring the lower limit.
   *
   * Counted on the VISIBLE text: the caps apply after Telegram parses entities,
   * so `<b>hi</b>` is two characters. Counting the raw markup would refuse text
   * that comfortably fits.
   */
  const bodyLength = visibleLength(body);
  const limit = images.length > 0 && bodyLength <= CAPTION_LIMIT ? CAPTION_LIMIT : TEXT_LIMIT;
  const splitsIntoTwoMessages = images.length > 0 && bodyLength > CAPTION_LIMIT;

  /** ⌘/Ctrl + B, I, U for the formatting people reach for most, and ⌘K for a
   *  link — which the toolbar's tooltip advertises, so it has to work. */
  const handleShortcut = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!event.metaKey && !event.ctrlKey) return;
    const key = event.key.toLowerCase();
    if (key === 'k') {
      event.preventDefault();
      insertLink(bodyRef.current, body, onBodyChange);
      return;
    }
    const tag = SHORTCUT_TAGS[key];
    if (!tag) return;
    event.preventDefault();
    wrapSelection(bodyRef.current, body, `<${tag}>`, `</${tag}>`, onBodyChange);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <FormatToolbar textareaRef={bodyRef} value={body} onChange={onBodyChange} />
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            onKeyDown={handleShortcut}
            placeholder="What should the students know?"
            className="min-h-[160px] font-mono text-sm"
          />
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className={bodyLength > TEXT_LIMIT ? 'text-rose-600' : 'text-muted-foreground'}>
              {bodyLength} / {limit}
            </span>
            {splitsIntoTwoMessages && (
              <span className="text-right text-muted-foreground">
                Over {CAPTION_LIMIT} characters — the text will arrive as a separate message below
                the photos.
              </span>
            )}
          </div>
        </div>

        {/* The preview is what makes showing raw tags acceptable: the sender
            always has the rendered result in front of them. */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className="min-h-[64px] rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono">
            {visibleText(body).trim() ? (
              <span dangerouslySetInnerHTML={{ __html: renderPreviewHtml(body) }} />
            ) : (
              <span className="text-muted-foreground">Nothing to preview yet.</span>
            )}
          </div>
        </div>

        <ImagePicker images={images} onChange={onImagesChange} />
        </CardContent>
      </Card>
      <MarkdownHtmlConverter
        onUse={(converted) => onBodyChange(body ? `${body}\n${converted}` : converted)}
      />
    </div>
  );
}
