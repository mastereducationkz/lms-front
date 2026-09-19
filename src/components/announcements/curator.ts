/**
 * Whether a Telegram group has a curator, read from its name.
 *
 * Like the program (see `programs.ts`), this lives only in the title staff
 * typed — "June 7 IELTS with curator" — because Telegram groups carry no other
 * metadata. One group says "with mentor" for the same role, so a mentor counts.
 *
 * "with" is part of every alias on purpose: a chat named after the role
 * ("Кураторы", "Curators team") is a staff chat, not a group that has one, and
 * because the alias must start at a word boundary, "without curator" never
 * matches either.
 *
 * Chats created since September tag the role instead: "SAT July 3|Curator".
 * A bare singular role right after a separator (| / - – — ( [) counts too;
 * "Curators team" or "Отдел | Кураторы" still read as staff chats.
 */

import { titlePattern } from './programs';

/** Extend here — the filter reads only this list. */
const CURATOR_ALIASES = [
  'with curator',
  'with curators',
  'with mentor',
  'with mentors',
  'с куратором',
  'с кураторами',
  'с ментором',
  'с менторами',
];

const CURATOR_PATTERN = titlePattern(CURATOR_ALIASES);

/** Extend here — the role words accepted as a tag after a separator. */
const TAGGED_ROLES = ['curator', 'mentor', 'куратор', 'ментор'];

const TAGGED_PATTERN = new RegExp(
  `[|/(\\[–—-]\\s*(?:${TAGGED_ROLES.join('|')})(?![\\p{L}])`,
  'iu',
);

// Older groups often put the role at the end of the title, usually inside
// parentheses: "IELTS August 6 CURATOR" or "... (CURATOR)".
const TRAILING_ROLE_PATTERN = new RegExp(
  `(?:^|[^\\p{L}])(?:${TAGGED_ROLES.join('|')})\\s*[)\\]]?$`,
  'iu',
);
const NEGATED_TRAILING_ROLE_PATTERN = new RegExp(
  `\\b(?:without|no)\\s+(?:${TAGGED_ROLES.join('|')})\\s*[)\\]]?$`,
  'iu',
);

export function hasCurator(title: string): boolean {
  return (
    CURATOR_PATTERN.test(title) ||
    TAGGED_PATTERN.test(title) ||
    (TRAILING_ROLE_PATTERN.test(title) && !NEGATED_TRAILING_ROLE_PATTERN.test(title))
  );
}
