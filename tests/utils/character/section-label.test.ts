import { describe, expect, it } from 'vitest';
import { sectionLabel } from '@/utils/character/section-label';

describe('sectionLabel', () => {
  it('returns canonical user-facing section names', () => {
    expect(sectionLabel('savingThrows')).toBe('Saves & Defences');
    expect(sectionLabel('features')).toBe('Features & Traits');
  });

  it('uses the character-specific companion title', () => {
    expect(sectionLabel('companions', 'Summons')).toBe('Summons');
  });
});