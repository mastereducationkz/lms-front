// The teacher part of a group name: «July 11 SAT - Арсен».
//
// Teacher names are stored «Фамилия Имя Отчество» — the owner's rule (2026-09-15), because
// that is the form people give their name in. The group name wants the first name, which is
// therefore the SECOND word; taking the first word put surnames into group names
// («July 11 SAT - Кенжебаев»). When two teachers share a first name the tail carries the
// surname initial as well («Мирас А.» / «Мирас Қ.»). Same rule as crm-master
// frontend/src/lib/groupNames.ts — keep the two in step.

// Heads' ФИО carries their title: «Head of NUET Керимхан Альбар».
const TITLE_PREFIX = /^\s*head\s+of\s+\S+\s+/i;

const words = (name: string | null | undefined): string[] =>
  (name ?? '').replace(TITLE_PREFIX, '').trim().split(/\s+/).filter(Boolean);

const fold = (value: string): string => value.trim().toLocaleLowerCase('ru');

/** «Кенжебаев Арсен» → «Арсен»; a one-word name is its own first name. */
export const teacherFirstName = (fullName: string | null | undefined): string => {
  const parts = words(fullName);
  return parts.length >= 2 ? parts[1] : parts[0] ?? '';
};

/** «Ақтай Мирас Айқынұлы» → «А.»; empty when the name has no surname. */
export const surnameInitial = (fullName: string | null | undefined): string => {
  const parts = words(fullName);
  return parts.length >= 2 ? `${parts[0].charAt(0).toLocaleUpperCase('ru')}.` : '';
};

/**
 * The tail for a group taught by `fullName`: «Арсен», or «Мирас А.» when another teacher in
 * `teacherNames` has the same first name. Two accounts with the identical full name are one
 * person and do not count as a clash.
 */
export const teacherGroupTail = (fullName: string, teacherNames: readonly string[] = []): string => {
  const first = teacherFirstName(fullName);
  if (!first) return '';
  const self = fold(fullName);
  const shared = teacherNames.some(
    (other) => fold(other) !== self && fold(teacherFirstName(other)) === fold(first),
  );
  const initial = surnameInitial(fullName);
  return shared && initial ? `${first} ${initial}` : first;
};
