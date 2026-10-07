import { describe, expect, it } from 'vitest';
import { THEME_OPTIONS, THEME_PROVIDER_PROPS, isDarkChoice } from './theme';

describe('theme defaults', () => {
  it('follows the device unless a theme was picked', () => {
    expect(THEME_PROVIDER_PROPS.defaultTheme).toBe('system');
    expect(THEME_PROVIDER_PROPS.enableSystem).toBe(true);
    expect(THEME_PROVIDER_PROPS.disableTransitionOnChange).toBe(true);
    expect(isDarkChoice(null, true)).toBe(true);
    expect(isDarkChoice(null, false)).toBe(false);
    expect(isDarkChoice('system', true)).toBe(true);
  });

  it('keeps an explicit choice over the device', () => {
    expect(isDarkChoice('light', true)).toBe(false);
    expect(isDarkChoice('dark', false)).toBe(true);
  });

  it('offers Light, Dark and System in the menu', () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(['light', 'dark', 'system']);
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(['Light', 'Dark', 'System']);
  });
});
