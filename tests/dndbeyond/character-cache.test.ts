import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheRawCharacter,
  readCachedCharacter,
} from '@/services/dndbeyond/character-cache';
import type { RawCharacter } from '@/services/dndbeyond/api-types';

const sample = {
  id: 7,
  name: 'Cached',
  stats: [],
  classes: [],
} as unknown as RawCharacter;

describe('character cache', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('stores and reads back raw character data', async () => {
    await cacheRawCharacter(7, sample);
    expect(await readCachedCharacter(7)).toEqual(sample);
  });

  it('returns null when nothing is cached for the id', async () => {
    expect(await readCachedCharacter(999)).toBeNull();
  });
});
