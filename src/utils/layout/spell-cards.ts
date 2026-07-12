import type { InjectionKey } from 'vue';
import type { CardKey } from '@/services/dndbeyond/model';

/** Prefix marking a synthetic per-spell card key (`spell:<slug>`). */
export const SPELL_CARD_PREFIX = 'spell:';

/** Fixed footprint of a per-spell card: 1 column wide, 2 row-units tall. */
export const SPELL_CARD_SPAN = { cols: 1, rows: 2 } as const;

/** Stable card key for a spell, derived from its (unique) name. */
export function spellCardKey(name: string): `spell:${string}` {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${SPELL_CARD_PREFIX}${slug}`;
}

/** True when a card key is a synthetic per-spell card. */
export function isSpellCardKey(key: CardKey | string): key is `spell:${string}` {
  return typeof key === 'string' && key.startsWith(SPELL_CARD_PREFIX);
}

/**
 * provide/inject token for the callback that flips the Spells section between
 * its single quick-sheet card and the set of individual per-spell cards.
 */
export const ToggleSpellCardsKey: InjectionKey<() => void> = Symbol('toggleSpellCards');
