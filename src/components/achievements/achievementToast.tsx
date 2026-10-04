/** The quiet way to announce a new achievement: a small toast, and tapping it opens the card. */
import { toast as sonnerToast } from 'sonner';

export function showAchievementToast(title: string, onOpen: () => void): void {
  sonnerToast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          sonnerToast.dismiss(id);
          onOpen();
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm shadow-lg transition-colors hover:bg-muted"
      >
        <span aria-hidden className="text-xl leading-none">🏆</span>
        <span className="min-w-0">
          New achievement: <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground"> — tap to see</span>
        </span>
      </button>
    ),
    { duration: 7000 },
  );
}
