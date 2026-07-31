import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { MessageReaction } from '../../types';

interface MessageReactionsProps {
  reactions: MessageReaction[];
  currentUserId: number | null;
  onToggle: (emoji: string) => void;
  align?: 'start' | 'end';
}

interface Grouped {
  emoji: string;
  count: number;
  mine: boolean;
  users: MessageReaction[];
}

function group(reactions: MessageReaction[], currentUserId: number | null): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const r of reactions) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, users: [] };
    g.count += 1;
    g.users.push(r);
    if (r.user_id === currentUserId) g.mine = true;
    map.set(r.emoji, g);
  }
  return Array.from(map.values());
}

/** Reaction chips under a bubble. Tap a chip to see who reacted and to toggle your own. */
export function MessageReactions({ reactions, currentUserId, onToggle, align = 'start' }: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) return null;
  const groups = group(reactions, currentUserId);

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {groups.map((g) => (
        <Popover key={g.emoji}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                g.mine
                  ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-700'
                  : 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
              }`}
              aria-label={`${g.count} reacted with ${g.emoji}`}
            >
              <span className="leading-none">{g.emoji}</span>
              <span className="text-gray-600 dark:text-gray-300">{g.count}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align={align === 'end' ? 'end' : 'start'} className="w-56 p-2">
            <div className="flex items-center gap-2 pb-2 mb-2 border-b dark:border-gray-700">
              <span className="text-lg">{g.emoji}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{g.count}</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {g.users.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {u.user_name || `User ${u.user_id}`}
                    {u.user_id === currentUserId ? ' (you)' : ''}
                  </span>
                  <span>{u.emoji}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onToggle(g.emoji)}
              className="w-full mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {g.mine ? 'Remove my reaction' : `React with ${g.emoji}`}
            </button>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
