import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { Flag, Plus, Reply } from 'lucide-react';
import { QUICK_REACTIONS } from './chatEmojis';

interface MessageContextMenuProps {
  children: React.ReactNode; // the bubble the menu is anchored to
  canReport: boolean;
  disabled?: boolean;
  onReact: (emoji: string) => void;
  onMoreEmojis: () => void;
  onReply: () => void;
  onReport: () => void;
}

const itemClass =
  'flex w-full cursor-pointer select-none items-center justify-between gap-6 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

/**
 * WhatsApp/Telegram-style message menu: a quick-reaction row above a small action card.
 * Radix's ContextMenu opens it on right-click and on a touch long-press, so the same
 * component covers pointer and touch without a separate gesture handler.
 */
export function MessageContextMenu({
  children, canReport, disabled, onReact, onMoreEmojis, onReply, onReport,
}: MessageContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-[11rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="flex items-center gap-0.5 pb-1 mb-1 border-b dark:border-gray-700">
            {QUICK_REACTIONS.map((emoji) => (
              <ContextMenuPrimitive.Item
                key={emoji}
                onSelect={() => onReact(emoji)}
                className="cursor-pointer rounded-full p-1 text-xl leading-none outline-none transition-transform focus:scale-125 focus:bg-gray-100 dark:focus:bg-gray-800"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </ContextMenuPrimitive.Item>
            ))}
            <ContextMenuPrimitive.Item
              onSelect={onMoreEmojis}
              className="ml-auto cursor-pointer rounded-full p-1.5 text-gray-500 outline-none focus:bg-gray-100 dark:text-gray-400 dark:focus:bg-gray-800"
              aria-label="More emoji"
            >
              <Plus className="w-4 h-4" />
            </ContextMenuPrimitive.Item>
          </div>

          <ContextMenuPrimitive.Item onSelect={onReply} className={itemClass}>
            Reply
            <Reply className="w-4 h-4" />
          </ContextMenuPrimitive.Item>
          {canReport && (
            <ContextMenuPrimitive.Item
              onSelect={onReport}
              className={`${itemClass} text-red-600 dark:text-red-400`}
            >
              Report
              <Flag className="w-4 h-4" />
            </ContextMenuPrimitive.Item>
          )}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}
