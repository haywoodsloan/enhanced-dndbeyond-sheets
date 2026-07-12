import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT_ID,
  DEFAULT_MARGIN_ID,
  DEFAULT_ORIENTATION_ID,
  MARGIN_PRESETS,
  PAGE_FORMATS,
  PAGE_ORIENTATIONS,
  mmToPx,
  orientedSize,
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

describe('page orientations', () => {
  it('offers portrait and landscape with a valid default', () => {
    expect(PAGE_ORIENTATIONS.map((orientation) => orientation.id)).toEqual([
      'portrait',
      'landscape',
    ]);
    expect(PAGE_ORIENTATIONS.some((orientation) => orientation.id === DEFAULT_ORIENTATION_ID)).toBe(
      true,
    );
  });
});

describe('orientedSize', () => {
  const letter = PAGE_FORMATS.find((format) => format.id === 'letter')!;

  it('keeps the portrait dimensions as-is', () => {
    expect(orientedSize(letter, 'portrait')).toEqual({ width: 215.9, height: 279.4 });
  });

  it('swaps width and height for landscape', () => {
    expect(orientedSize(letter, 'landscape')).toEqual({ width: 279.4, height: 215.9 });
  });

  it('treats an unknown orientation as portrait', () => {
    expect(orientedSize(letter, 'sideways')).toEqual({ width: 215.9, height: 279.4 });
  });
});
