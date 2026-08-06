import { useState } from 'react';
import { Check, Reply, SmilePlus } from 'lucide-react';
import type { Message } from '../../types';
import { ChatAttachment } from './ChatAttachment';
import { MessageReactions } from './MessageReactions';
import { EmojiPicker } from './EmojiPicker';
import { MessageContextMenu } from './MessageContextMenu';

/** A chat message augmented with client-only optimistic-send state. `_status`
 * undefined = confirmed by the server; "pending" = awaiting the echo; "failed" = the
 * send did not go through and can be retried. `_clientId` ties an optimistic bubble to
 * its eventual server echo so it can be reconciled in place. */
export type ChatMessage = Message & {
  _status?: 'pending' | 'failed';
  _clientId?: string;
};

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  currentUserId: number | null;
  formatTime: (dateString: string) => string;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: number, emoji: string) => void;
  onJumpTo: (messageId: number) => void;
  onRetry: (message: ChatMessage) => void;
  onReport: (messageId: number) => void;
  registerRef: (id: number, el: HTMLDivElement | null) => void;
}

/** WhatsApp-style read receipt: single tick = sent, double grey = delivered,
 * double blue = read. Only shown on the current user's own outgoing messages. */
function ReadReceipt({ message }: { message: Message }) {
  const delivered = !!message.delivered_at || message.is_read || !!message.read_at;
  const read = !!message.read_at || message.is_read;
  return (
    <span className={`relative inline-flex items-center ${read ? 'text-sky-300' : 'text-blue-100'}`}>
      {delivered ? (
        <>
          <Check className="w-3 h-3" strokeWidth={2.5} />
          <Check className="w-3 h-3 -ml-1.5" strokeWidth={2.5} />
        </>
      ) : (
        <Check className="w-3 h-3" strokeWidth={2.5} />
      )}
    </span>
  );
}

export function ChatMessageBubble({
  message, isMine, currentUserId, formatTime, onReply, onReact, onJumpTo, onRetry, onReport, registerRef,
}: ChatMessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isPending = message._status === 'pending';
  const isFailed = message._status === 'failed';
  const unsent = isPending || isFailed;

  const actions = (
    <div
      className={`flex items-center gap-0.5 transition-opacity self-center ${
        pickerOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={() => onReply(message)}
        disabled={unsent}
        className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Reply"
        title="Reply"
      >
        <Reply className="w-4 h-4" />
      </button>
      <EmojiPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(emoji) => onReact(message.id, emoji)}
        align={isMine ? 'end' : 'start'}
      >
        <button
          type="button"
          disabled={unsent}
          className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="React"
          title="React"
        >
          <SmilePlus className="w-4 h-4" />
        </button>
      </EmojiPicker>
    </div>
  );

  const bubble = (
    <div
      className={`px-3 py-2 rounded-xl text-sm ${
        isMine ? 'bg-blue-600 text-white' : 'bg-white dark:bg-card border dark:border-gray-700 shadow-sm'
      } ${isPending ? 'opacity-70' : ''} ${isFailed ? 'ring-1 ring-red-500' : ''}`}
    >
      {message.reply_preview && (
        <button
          type="button"
          onClick={() => onJumpTo(message.reply_preview!.id)}
          className={`block w-full text-left mb-1 rounded-md px-2 py-1 border-l-2 ${
            isMine
              ? 'bg-blue-500/40 border-white/70'
              : 'bg-gray-100 dark:bg-gray-800 border-blue-500'
          }`}
        >
          <span className={`block text-[11px] font-semibold ${isMine ? 'text-blue-50' : 'text-blue-600 dark:text-blue-400'}`}>
            {message.reply_preview.sender_name || 'Message'}
          </span>
          <span className={`block text-xs truncate ${isMine ? 'text-blue-50/90' : 'text-gray-600 dark:text-gray-300'}`}>
            {message.reply_preview.content || (message.reply_preview.file_url ? '📎 Attachment' : '')}
          </span>
        </button>
      )}

      {message.file_url && <ChatAttachment fileUrl={message.file_url} />}
      <div className="flex items-start gap-2">
        <span className="flex-1 whitespace-pre-wrap break-words">{message.content}</span>
        <span className={`text-[10px] whitespace-nowrap mt-auto flex items-center gap-0.5 ${
          isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
        }`}>
          {formatTime(message.created_at)}
          {isPending && <span>· sending…</span>}
          {isFailed && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="font-semibold text-red-200 underline hover:text-white"
            >
              · failed · retry
            </button>
          )}
          {isMine && !unsent && <ReadReceipt message={message} />}
        </span>
      </div>
    </div>
  );

  return (
    <div
      ref={(el) => registerRef(message.id, el)}
      className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex items-end gap-1 max-w-[85%] sm:max-w-[70%] ${isMine ? 'flex-row' : 'flex-row-reverse'}`}>
        {actions}
        <div className="min-w-0">
          <MessageContextMenu
            canReport={!isMine}
            disabled={unsent}
            onReact={(emoji) => onReact(message.id, emoji)}
            // Radix returns focus to the trigger as the menu closes, which would immediately
            // dismiss a popover opened inside onSelect — so hand the picker to the next tick.
            onMoreEmojis={() => setTimeout(() => setPickerOpen(true), 0)}
            onReply={() => onReply(message)}
            onReport={() => onReport(message.id)}
          >
            {bubble}
          </MessageContextMenu>

          <MessageReactions
            reactions={message.reactions || []}
            currentUserId={currentUserId}
            onToggle={(emoji) => onReact(message.id, emoji)}
            align={isMine ? 'end' : 'start'}
          />
        </div>
      </div>
    </div>
  );
}
