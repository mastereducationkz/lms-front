export type ResultStatusValue = 'reported' | 'verified' | 'rejected';

/**
 * «Без подтверждения»: entered and not yet confirmed, with no proof file behind it. A VERIFIED row
 * without proof (Master League rows are written verified and proof-less) is vouched for and is not
 * flagged; neither is a rejected one.
 */
export const isUnconfirmed = (r: { status: ResultStatusValue; has_proof: boolean }): boolean =>
  r.status === 'reported' && !r.has_proof;

export const STATUS_TONE: Record<ResultStatusValue, string> = {
  reported: 'bg-muted text-foreground',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
