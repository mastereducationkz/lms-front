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
