/**
 * A person's first name out of `users.name`, by the backend's rule (lms-backend
 * src/utils/person_names.py): the school writes Cyrillic names family name first («Фамилия Имя»,
 * «Фамилия Имя Отчество»), so the first name is the second word; a Latin-only name is read
 * «Name Surname». Keep the two in step.
 */
const LATIN = /[A-Za-z]/;
const CYRILLIC = /[Ѐ-ӿ]/;

export function firstName(full: string | null | undefined): string {
  const tokens = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return tokens[0] ?? '';
  const latinOnly = LATIN.test(full!) && !CYRILLIC.test(full!);
  return latinOnly ? tokens[0] : tokens[1];
}
