/**
 * The Master League season theme's name, with no dependencies, so the API parsers can read it
 * without pulling in the translation catalogues. The rules that use it live in ./leagueTheme.
 */
export type LeagueTheme = 'football' | 'studio';

export const LEAGUE_THEMES: readonly LeagueTheme[] = ['football', 'studio'];

/** The server's word, read strictly: only 'studio' is studio; missing or unknown is football. */
export const asLeagueTheme = (value: unknown): LeagueTheme => (value === 'studio' ? 'studio' : 'football');
