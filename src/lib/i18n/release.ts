/**
 * The per-user language switch (Q27). Released 2026-10-07 after the owner approved the Russian (Q43).
 * Setting RELEASED back to false hides it again: Settings then shows the app language read-only and
 * everyone keeps their role's language. `VITE_LANGUAGE_SWITCH=on` forces it on locally.
 */
const RELEASED = true;

export function languageSwitchEnabled(): boolean {
  return RELEASED || import.meta.env.VITE_LANGUAGE_SWITCH === 'on';
}
