import { describe, expect, it } from 'vitest';
import { SECTION_KEYS } from '@/services/dndbeyond/model';
import { CONTENT_FIT_SECTIONS, sectionLayoutCount, sectionSpan } from '@/utils/layout/section-layout';
import { defaultSectionOrder } from '@/utils/layout/section-order';
import { sectionLabel } from '@/utils/character/section-label';
import { makeCharacter } from '../../fixtures/character';

describe('supporting reference sections', () => {
  it.each(['companions', 'tables'] as const)('lays out %s with measured content and narrow alternatives', (key) => {
    expect(SECTION_KEYS).toContain(key);
    expect(CONTENT_FIT_SECTIONS.has(key)).toBe(true);
    expect(sectionSpan(key)).toEqual({ cols: 3, rows: 2 });
    expect(sectionLayoutCount(key)).toBe(3);
    expect(sectionSpan(key, 1, 2).cols).toBe(1);
  });

  it('keeps references between their features and inventory and moves empties to the end', () => {
    const character = makeCharacter({
      sections: ['notes', 'inventory', 'tables', 'companions', 'features'].map((key) => ({
        key: key as 'notes' | 'inventory' | 'tables' | 'companions' | 'features',
        title: key, count: 1, isEmpty: false,
      })),
    });
    expect(defaultSectionOrder(character).map((section) => section.key)).toEqual([
      'features', 'companions', 'tables', 'inventory', 'notes',
    ]);
    character.sections.find((section) => section.key === 'companions')!.isEmpty = true;
    expect(defaultSectionOrder(character).at(-1)?.key).toBe('companions');
  });

  it('uses the actual companion section title in references', () => {
    expect(sectionLabel('companions')).toBe('Companions');
    expect(sectionLabel('companions', 'Wild Forms')).toBe('Wild Forms');
    expect(sectionLabel('tables', 'Wild Forms')).toBe('Tables');
  });
});
