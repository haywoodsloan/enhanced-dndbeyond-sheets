import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  hiddenSectionsPref,
  pageFormatPref,
  sectionOrderPref,
  themeColorPref,
} from '@/utils/preferences';

describe('preferences', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns the fallback when nothing is stored', async () => {
    expect(await pageFormatPref.get('letter')).toBe('letter');
    expect(await sectionOrderPref.get([])).toEqual([]);
  });

  it('persists and reads back a scalar preference', async () => {
    await themeColorPref.set('violet');
    expect(await themeColorPref.get('blue')).toBe('violet');
  });

  it('round-trips the section order array', async () => {
    await sectionOrderPref.set(['basics', 'attributes', 'skills']);
    expect(await sectionOrderPref.get([])).toEqual(['basics', 'attributes', 'skills']);
  });

  it('round-trips the hidden sections array', async () => {
    await hiddenSectionsPref.set(['spells', 'notes']);
    expect(await hiddenSectionsPref.get([])).toEqual(['spells', 'notes']);
  });
});
