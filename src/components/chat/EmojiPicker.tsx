import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { QUICK_REACTIONS, EMOJI_GROUPS } from './chatEmojis';

interface EmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  children: React.ReactNode; // the trigger element
  align?: 'start' | 'center' | 'end';
}

/**
 * WhatsApp-style emoji picker: a quick-reaction row on top of a scrollable,
 * grouped grid of "any emoji". Anchored to whatever `children` trigger is passed.
 */
export function EmojiPicker({ open, onOpenChange, onSelect, children, align = 'center' }: EmojiPickerProps) {
  const pick = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-2">
        <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b dark:border-gray-700">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => pick(emoji)}
              className="text-2xl leading-none p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform hover:scale-125"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500 px-1 mb-1">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pick(emoji)}
                    className="text-xl leading-none p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
