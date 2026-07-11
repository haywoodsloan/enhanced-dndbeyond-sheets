import { describe, expect, it } from 'vitest';
import { characterSubtitle } from '@/utils/character/character-summary';
import { makeCharacter } from '../../fixtures/character';

describe('characterSubtitle', () => {
  it('joins race and class with a middot', () => {
    const character = makeCharacter({
      race: 'Elf',
      classes: [{ name: 'Cleric', level: 4, subclass: 'Grave Domain' }],
    });
    expect(characterSubtitle(character)).toBe('Elf · Cleric 4 (Grave Domain)');
  });

  it('omits the race when absent and joins multiclasses with a slash', () => {
    const character = makeCharacter({
      classes: [
        { name: 'Fighter', level: 3 },
        { name: 'Wizard', level: 2 },
      ],
    });
    expect(characterSubtitle(character)).toBe('Fighter 3 / Wizard 2');
  });
});
