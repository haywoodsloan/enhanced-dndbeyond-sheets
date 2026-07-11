import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT_ID,
  DEFAULT_MARGIN_ID,
  MARGIN_PRESETS,
  PAGE_FORMATS,
  mmToPx,
} from '@/utils/layout/page-format';

describe('page formats', () => {
  it('includes common worldwide sizes, all portrait', () => {
    const ids = PAGE_FORMATS.map((format) => format.id);
    expect(ids).toEqual(
      expect.arrayContaining(['letter', 'legal', 'tabloid', 'a3', 'a4', 'a5']),
    );
    for (const format of PAGE_FORMATS) {
      expect(format.width).toBeLessThan(format.height);
    }
  });

  it('has correct Letter and A4 dimensions in millimeters', () => {
    expect(PAGE_FORMATS.find((format) => format.id === 'letter')).toMatchObject({
      width: 215.9,
      height: 279.4,
    });
    expect(PAGE_FORMATS.find((format) => format.id === 'a4')).toMatchObject({
      width: 210,
      height: 297,
    });
  });

  it('exposes defaults that exist in their lists', () => {
    expect(PAGE_FORMATS.some((format) => format.id === DEFAULT_FORMAT_ID)).toBe(true);
    expect(MARGIN_PRESETS.some((preset) => preset.id === DEFAULT_MARGIN_ID)).toBe(true);
  });
});

describe('mmToPx', () => {
  it('converts millimeters to CSS pixels (96px per inch)', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96);
    expect(mmToPx(0)).toBe(0);
  });
});
