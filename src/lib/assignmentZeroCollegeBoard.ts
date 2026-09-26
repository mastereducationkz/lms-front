/**
 * Whether Assignment Zero's "account" step must force the student to (re)type a
 * College Board password before moving on.
 *
 * G9 a′ (2026-09-26): the plaintext password no longer travels with any list or
 * profile response — the API only says whether one is already stored
 * (`has_college_board_password`). A student who already saved one must not be made
 * to retype it just to keep filling out the form; leaving the field blank on
 * save-progress/submit is safe (the server keeps whatever it already has).
 */
export function isCollegeBoardPasswordRequired(showSAT: boolean, hasCollegeBoardPassword: boolean): boolean {
  return showSAT && !hasCollegeBoardPassword;
}

/**
 * The three ways a College Board password value can render for a viewer:
 * - `none` — nothing is stored; show the "—" placeholder.
 * - `hidden_no_access` — a password is stored, but this viewer isn't allowed to
 *   reveal it (`can_reveal_college_board_password: false`): show nothing at all
 *   for the value, no button, no dots. (A 403 from the reveal endpoint itself is
 *   a separate, still-possible case — e.g. permissions changed after load — and
 *   keeps its own "Access denied" message; this is a purely client-side decision
 *   to avoid even offering the button.)
 * - `revealable` — a password is stored and this viewer may reveal it: show the
 *   masked "•••••• Show" control.
 *
 * `canReveal` is `can_reveal_college_board_password` from the server and may be
 * absent on a backend that hasn't shipped the flag yet; `defaultCanReveal` is
 * what "absent" means at a given call site (the admin-only AZ submissions page
 * defaults to true; StudentProfilePage, reachable by curators generally, defaults
 * to false).
 */
export type CollegeBoardPasswordDisplay = 'none' | 'hidden_no_access' | 'revealable';

export function collegeBoardPasswordDisplay(
  hasPassword: boolean,
  canReveal: boolean | undefined,
  defaultCanReveal: boolean,
): CollegeBoardPasswordDisplay {
  if (!hasPassword) return 'none';
  return (canReveal ?? defaultCanReveal) ? 'revealable' : 'hidden_no_access';
}
