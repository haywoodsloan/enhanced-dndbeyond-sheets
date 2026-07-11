import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_ID, THEME_COLORS } from '@/utils/settings/theme-color';

describe('theme colors', () => {
  it('offers named colors with hex bases', () => {
    expect(THEME_COLORS.length).toBeGreaterThan(3);
    for (const color of THEME_COLORS) {
      expect(color.base).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('exposes a default that exists in the list', () => {
    expect(THEME_COLORS.some((color) => color.id === DEFAULT_COLOR_ID)).toBe(true);
  });
});
