import { describe, expect, it } from 'vitest';
import { sectionSize } from '@/utils/section-layout';

describe('sectionSize', () => {
  it('gives larger cards to content-heavy sections', () => {
    expect(sectionSize('spells')).toBe('large');
    expect(sectionSize('features')).toBe('large');
    expect(sectionSize('attributes')).toBe('medium');
    expect(sectionSize('inventory')).toBe('medium');
    expect(sectionSize('attacks')).toBe('small');
  });
});
