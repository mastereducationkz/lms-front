// What a head teacher is allowed to submit when they price or waive a finding.
//
// The rule proposes a number; a person decides it. That decision is money taken from somebody's
// pay, so the two things that make it reviewable later are enforced here rather than in the
// dialog: the amount has to be a real non-negative figure, and taking money *off* what the rule
// asked has to come with a reason. Adding to it, or confirming it, does not — nobody needs an
// explanation for applying the rule as written.
//
// Kept apart from the dialog because this repo's tests run in `node`: the dialog stays thin and
// this is what is actually covered.

export type DecisionDraft = {
  /** Raw text from the input, exactly as typed — «1 400», «1400», «» are all plausible. */
  amount: string;
  reasonCode: string | null;
  note: string;
};

export type DecisionCheck = {
  /** The parsed amount, or null when it is not a usable figure yet. */
  amount: number | null;
  /** True when this decision takes money off what the rule asked, so it owes an explanation. */
  needsReason: boolean;
  /** What is wrong, in words a head teacher can act on; null when nothing is. */
  error: string | null;
  /** Whether it can be submitted. */
  ready: boolean;
};

/** «1 400» and «1400» are the same number; a stray space should not block a decision. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s ]/g, '');
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * @param proposed what the rule asked for — null for a miss, which only a person can price.
 */
export function checkDecision(draft: DecisionDraft, proposed: number | null): DecisionCheck {
  const amount = parseAmount(draft.amount);
  // Reducing the rule's figure — waiving is just reducing it to zero — is the case that has to
  // be explainable months later, when somebody asks why this teacher paid less.
  const needsReason = amount !== null && proposed !== null && amount < proposed;

  if (draft.amount.trim() === '') {
    return { amount, needsReason, error: 'Enter an amount', ready: false };
  }
  if (amount === null) {
    return { amount, needsReason, error: 'Only whole tenge, digits alone', ready: false };
  }
  if (needsReason && !draft.reasonCode) {
    return { amount, needsReason, error: 'Choose a reason for lowering it', ready: false };
  }
  return { amount, needsReason, error: null, ready: true };
}

/** What the API is actually sent. `note` is optional everywhere and travels as null when blank. */
export function decisionPayload(draft: DecisionDraft, proposed: number | null) {
  const check = checkDecision(draft, proposed);
  if (!check.ready || check.amount === null) return null;
  return {
    amount: check.amount,
    // A reason on a decision that did not lower anything is still worth keeping if it was given.
    reason_code: draft.reasonCode || null,
    note: draft.note.trim() || null,
  };
}
