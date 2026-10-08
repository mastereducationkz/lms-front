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
 * Numbers are compared as numbers and everything else as trimmed, case-folded text. An answer is
 * accepted only when it is *equal*, never when it is merely close:
 *
 * - a comma is a decimal point (`13,5`) unless it groups thousands (`40,260`); a space between
 *   groups of three digits is a thousands separator too (`1 000`), but digits are never glued
 *   (`1 5` is not 15);
 * - `.5` and `5.`, a trailing `%`, fractions `a/b` and mixed numbers `1 1/2`;
 * - a leading `x=` / `k =` and a trailing unit (`12 cm`, `45°`), but not a scale word
 *   (`12 million`) or a one-letter suffix (`5x`); a unit written on one side only is ignored, two
 *   different units are not equal;
 * - dots as thousands separators (`35.728` for `35728`), only when the key is a whole number of
 *   1 000 or more, so `9.990` is never read as 999;
 * - no rounding and no tolerance beyond binary floating point: `94.16` is not `94`.
 *
 * The server's twin is lms-backend `src/utils/answer_match.py`. Both read the same table of
 * cases (`answerMatch.vectors.json` here, `tests/fixtures/answer_match_vectors.json` there): keep
 * the two files identical, and port every rule to both.
 */

const MINUS = /−/g;
const SPACES = '   ';

const THOUSANDS_COMMA = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;
const THOUSANDS_SPACE = new RegExp(`^[+-]?\\d{1,3}([${SPACES}]\\d{3})+([.,]\\d+)?$`);
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const FRACTION = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*(\d+(?:\.\d*)?|\.\d+)$/;
const MIXED = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/;
const DOT_GROUPS = /^[+-]?\d{1,3}(\.\d{3})+$/;
const VARIABLE = /^[A-Za-z]\w?\s*=\s*(.+)$/;
const TRAILING_UNIT = /^(.*?[\d.])\s*(\p{L}+\.?|[°$€₸])$/u;
const SCALE_WORD = /^(thousands?|millions?|billions?|trillions?|[kmb]|bn|тыс\p{L}*|млн|млрд|трлн)\.?$/iu;

const asString = (value: unknown): string => (value ?? '').toString();
const asText = (value: unknown): string => asString(value).trim().toLowerCase();

/** The value of a typed number, or null when it is not one. */
export function numericValue(raw: unknown): number | null {
  let t = asString(raw).replace(MINUS, '-').trim();
  if (!t) return null;
  if (t.endsWith('%')) t = t.slice(0, -1).trimEnd();
  const mixed = t.match(MIXED);
  if (mixed) {
    const denominator = Number(mixed[4]);
    if (denominator === 0) return null;
    const value = Number(mixed[2]) + Number(mixed[3]) / denominator;
    return mixed[1] === '-' ? -value : value;
  }
  if (THOUSANDS_COMMA.test(t)) t = t.replace(/,/g, '');
  else if (THOUSANDS_SPACE.test(t)) t = t.replace(new RegExp(`[${SPACES}]`, 'g'), '').replace(',', '.');
  else t = t.replace(',', '.');
  if (NUMBER.test(t)) return Number(t);
  const fraction = t.match(FRACTION);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  return null;
}

/** `[value, unit]` of a number that may carry an `x=` prefix and a unit, else null. */
function numberAndUnit(raw: unknown): [number, string] | null {
  let text = asString(raw).trim();
  if (!text) return null;
  let plain = numericValue(text);
  if (plain !== null) return [plain, ''];
  const variable = text.match(VARIABLE);
  if (variable) {
    text = variable[1].trim();
    plain = numericValue(text);
    if (plain !== null) return [plain, ''];
  }
  const unit = text.match(TRAILING_UNIT);
  if (unit) {
    const word = unit[2].replace(/\.$/, '');
    if (SCALE_WORD.test(unit[2]) || (/^\p{L}+$/u.test(word) && word.length < 2)) return null;
    const value = numericValue(unit[1]);
    if (value !== null) return [value, word.toLowerCase()];
  }
  return null;
}

// A tolerance only for binary floating point (0.1 + 0.2), never wide enough to accept another answer.
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** One stored answer against one typed answer (`a|b` alternatives are `matchesAnyAnswer`'s job). */
export function answersMatch(expected: unknown, provided: unknown): boolean {
  const e = asText(expected);
  const p = asText(provided);
  if (!e || !p) return false;
  if (e === p) return true;
  const key = numberAndUnit(expected);
  if (key === null) return false;
  const [keyValue, keyUnit] = key;
  // "35.728" for 35728: dots grouping thousands, only for a whole key of 1 000 or more.
  if (Number.isInteger(keyValue) && Math.abs(keyValue) >= 1000 && !keyUnit && DOT_GROUPS.test(p)
    && close(keyValue, Number(p.replace(/\./g, '')))) {
    return true;
  }
  const typed = numberAndUnit(provided);
  if (typed === null) return false;
  const [typedValue, typedUnit] = typed;
  if (keyUnit && typedUnit && keyUnit !== typedUnit) return false;
  return close(keyValue, typedValue);
}

/** `a|b|c` as a list, trimmed, without empty parts. A list key is taken as its alternatives. */
export function splitAlternatives(key: unknown): string[] {
  const parts = Array.isArray(key) ? key.map(asString) : asString(key).split('|');
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Is `provided` any of the answers `key` accepts? */
export function matchesAnyAnswer(key: unknown, provided: unknown): boolean {
  return splitAlternatives(key).some((alternative) => answersMatch(alternative, provided));
}
