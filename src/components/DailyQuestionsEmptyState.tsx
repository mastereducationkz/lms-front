import { Button } from './ui/button';

interface DailyQuestionsEmptyStateProps {
  onDismiss: () => void;
}

/**
 * Shown instead of the generic error block when a student simply has no daily questions
 * yet — no SAT data (old backend: 404, new backend: 200 with an empty shape). It isn't a
 * failure, so the copy says so instead of "Oops! Something went wrong". Kept as its own
 * tiny component so it can be server-rendered in a test without mounting the full popup
 * (which needs auth context and live API calls) — see SubmissionFileDownloadLink for the
 * same pattern.
 */
export function DailyQuestionsEmptyState({ onDismiss }: DailyQuestionsEmptyStateProps) {
  return (
    <div className="p-8 text-center">
      <div className="text-6xl mb-4">📝</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No daily questions yet</h3>
      <p className="text-gray-600 mb-6">
        You haven't completed any Weekly Tests yet. Complete a test first to get personalized daily questions!
      </p>
      <Button variant="outline" onClick={onDismiss}>Close</Button>
    </div>
  );
}
