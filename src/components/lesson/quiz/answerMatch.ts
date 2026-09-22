/**
 * Does a typed answer match the stored one?
 *
 * Until 2026-09-23 this was a plain string comparison, so a student who worked the problem out
 * correctly was marked wrong for writing the number a different way. Kazakh and Russian write
 * decimals with a comma, and nothing on screen said which form the box wanted:
 *
 *   key 13.5   student 13,5   -> wrong
 *   key 2.5    student 5/2    -> wrong  ("I don't know how to write the answer: 5/2 or 2.5")
 *   key 0.75   student 3/4    -> wrong
 *
 * Those are real reports. The cost is larger than the reports, because most students who are
 * marked wrong never report it — they just believe they got it wrong.
 *
 * Numbers are therefore compared as numbers and everything else as trimmed, case-folded text.
 * Deliberately conservative: it only ever accepts an answer that is *equal*, never one that is
 * merely close, and when a value cannot be read as a number both sides fall back to text.
 */

const MINUS = /−/g;

/** The value of a typed number, or null when it is not one. Handles comma decimals and a/b. */
export function numericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let t = raw.toString().replace(MINUS, '-').trim();
  if (!t) return null;
  // A comma is a decimal point only when it is used as one. "1,000" is a thousand to a student
  // writing English, so a comma with exactly three digits after it is left as a separator.
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  t = t.replace(/\s+/g, '');
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return Number(t);
  const frac = t.match(/^([+-]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const denominator = Number(frac[2]);
    if (denominator === 0) return null;
    return Number(frac[1]) / denominator;
  }
  return null;
}

const asText = (value: unknown): string => (value ?? '').toString().trim().toLowerCase();

export function answersMatch(expected: unknown, provided: unknown): boolean {
  const e = asText(expected);
  const p = asText(provided);
  if (!e || !p) return false;
  if (e === p) return true;
  const en = numericValue(expected);
  const pn = numericValue(provided);
  if (en === null || pn === null) return false;
  // Both are numbers: compare as numbers, with a tolerance only for binary floating point
  // (0.1 + 0.2), never wide enough to accept a different answer.
  return Math.abs(en - pn) <= 1e-9 * Math.max(1, Math.abs(en), Math.abs(pn));
}
