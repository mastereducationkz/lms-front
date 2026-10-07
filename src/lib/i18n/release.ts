/**
 * The per-user language switch (Q27) stays hidden until the owner has read the Russian (Q43): until
 * then Settings shows the app language read-only and everyone keeps their role's language.
 * Release = set RELEASED to true. Preview it locally with `VITE_LANGUAGE_SWITCH=on`.
 */
const RELEASED = false;

export function languageSwitchEnabled(): boolean {
  return RELEASED || import.meta.env.VITE_LANGUAGE_SWITCH === 'on';
}
