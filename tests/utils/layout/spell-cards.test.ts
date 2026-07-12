import { describe, expect, it } from 'vitest';
import { isSpellCardKey, spellCardKey } from '@/utils/layout/spell-cards';

describe('spell-cards', () => {
  it('builds a stable slug key from a spell name', () => {
    expect(spellCardKey('Fire Bolt')).toBe('spell:fire-bolt');
    expect(spellCardKey("Mordenkainen's Sword")).toBe('spell:mordenkainen-s-sword');
    expect(spellCardKey('  Cure Wounds  ')).toBe('spell:cure-wounds');
  });

  it('detects synthetic spell-card keys', () => {
    expect(isSpellCardKey('spell:fire-bolt')).toBe(true);
    expect(isSpellCardKey('spells')).toBe(false);
    expect(isSpellCardKey('actions')).toBe(false);
  });
});
