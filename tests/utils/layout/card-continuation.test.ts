import { describe, expect, it } from 'vitest';
import {
  continuationBaseKey,
  continuationKey,
  isContinuationKey,
  sliceContent,
} from '@/utils/layout/card-continuation';

describe('card-continuation keys', () => {
  it('builds and detects continuation keys', () => {
    expect(continuationKey('spells', 1)).toBe('spells~cont~1');
    expect(continuationKey('actions', 2)).toBe('actions~cont~2');
    expect(isContinuationKey('spells~cont~1')).toBe(true);
    expect(isContinuationKey('spells')).toBe(false);
    expect(isContinuationKey('spell:fire-bolt')).toBe(false);
  });

  it('recovers the base key of a continuation (identity for a base key)', () => {
    expect(continuationBaseKey('spells~cont~1')).toBe('spells');
    expect(continuationBaseKey('features~cont~3')).toBe('features');
    expect(continuationBaseKey('actions')).toBe('actions');
    expect(continuationBaseKey('spell:fire-bolt')).toBe('spell:fire-bolt');
  });
});

describe('sliceContent', () => {
  it('returns a single full slice when the content fits', () => {
    expect(sliceContent([100, 200], 200, 500)).toEqual([
      { start: 0, end: 2, offset: 0, height: 200 },
    ]);
  });

  it('splits at the last item boundary that fits each page', () => {
    const slices = sliceContent([100, 200, 300, 400], 400, 250);
    expect(slices).toEqual([
      { start: 0, end: 2, offset: 0, height: 200 },
      { start: 2, end: 4, offset: 200, height: 200 },
    ]);
  });

  it('covers the whole body with contiguous, gap-free slices', () => {
    const total = 900;
    const slices = sliceContent([150, 300, 450, 600, 750, 900], total, 320);
    // First slice starts at item 0, each next starts where the previous ended (in
    // both items and pixels), and the last reaches the content end — no item is
    // dropped or double-counted.
    expect(slices[0].offset).toBe(0);
    expect(slices[0].start).toBe(0);
    for (let i = 1; i < slices.length; i += 1) {
      expect(slices[i].offset).toBe(slices[i - 1].offset + slices[i - 1].height);
      expect(slices[i].start).toBe(slices[i - 1].end);
    }
    const last = slices[slices.length - 1];
    expect(last.offset + last.height).toBe(total);
    expect(last.end).toBe(6);
  });

  it('gives an over-tall single item its own (still overflowing) slice', () => {
    // One 500px item can't fit a 250px page; it takes a whole slice rather than
    // being cut, and slicing still progresses to the end.
    expect(sliceContent([500], 500, 250)).toEqual([{ start: 0, end: 1, offset: 0, height: 500 }]);
    expect(sliceContent([100, 600], 600, 250)).toEqual([
      { start: 0, end: 1, offset: 0, height: 100 },
      { start: 1, end: 2, offset: 100, height: 500 },
    ]);
  });

  it('falls back to a single slice when there are no break points', () => {
    expect(sliceContent([], 600, 250)).toEqual([{ start: 0, end: 0, offset: 0, height: 600 }]);
  });
});
