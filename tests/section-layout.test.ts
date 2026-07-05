import { describe, expect, it } from 'vitest';
import { CARD_SPAN, sectionSize } from '@/utils/section-layout';

describe('sectionSize', () => {
  it('gives larger cards to content-heavy sections', () => {
    expect(sectionSize('spells')).toBe('large');
    expect(sectionSize('features')).toBe('large');
    expect(sectionSize('attributes')).toBe('medium');
    expect(sectionSize('inventory')).toBe('medium');
    expect(sectionSize('attacks')).toBe('small');
  });
});

describe('CARD_SPAN', () => {
  it('maps sizes to 1/2/3 columns', () => {
    expect(CARD_SPAN).toEqual({ small: 1, medium: 2, large: 3 });
  });
});
