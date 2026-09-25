import { describe, expect, it } from 'vitest';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';
import type { RawCharacter } from '@/services/dndbeyond/api-types';

const base: RawCharacter = {
  id: 1,
  name: 'Spell resource fixture',
  stats: [
    { id: 4, name: 'Intelligence', value: 14 },
    { id: 5, name: 'Wisdom', value: 18 },
    { id: 6, name: 'Charisma', value: 16 },
  ],
  classes: [],
};

describe('spell resource parity', () => {
  it('retains separately recharging grants of the same spell without duplicate pools', () => {
    const shortRestGrant = {
      componentId: 101,
      componentTypeId: 1088085227,
      definition: { id: 501, name: 'Shared Ward', level: 1 },
      limitedUse: { maxUses: 1, resetType: 1 },
    };
    const longRestGrant = {
      ...shortRestGrant,
      componentId: 102,
      limitedUse: { maxUses: 2, resetType: 2 },
    };
    const character = normalizeCharacter({
      ...base,
      feats: [
        { definition: { id: 101, name: 'Dawn Gift' } },
        { definition: { id: 102, name: 'Night Gift' } },
      ],
      spells: { feat: [shortRestGrant, shortRestGrant, longRestGrant] },
    });

    expect(character.spells).toHaveLength(1);
    expect(character.spells[0]).toMatchObject({
      name: 'Shared Ward',
      featureUses: [
        { source: 'Dawn Gift', pool: { max: 1, recharge: 'SR' } },
        { source: 'Night Gift', pool: { max: 2, recharge: 'LR' } },
      ],
    });
  });

  it('keeps pact slots separate from ordinary long-rest spell slots', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [{
        level: 5,
        definition: {
          name: 'Warlock',
          spellCastingAbilityId: 6,
          spellRules: {
            multiClassSpellSlotDivisor: 1,
            levelSpellSlots: [
              [], [1], [2], [0, 2], [0, 2], [0, 0, 2],
            ],
          },
        },
      }],
    });

    expect(character.spellcasting).toMatchObject({
      ability: 'CHA',
      modifier: 3,
      attack: 6,
      saveDc: 14,
      slots: [],
      pactSlots: [{ source: 'Warlock', level: 3, max: 2 }],
    });
  });

  it('retains each casting class ability and save DC in a multiclass sheet', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [
        {
          level: 5,
          definition: {
            name: 'Cleric',
            spellCastingAbilityId: 5,
            spellRules: { multiClassSpellSlotDivisor: 1 },
          },
        },
        {
          level: 3,
          definition: {
            name: 'Wizard',
            spellCastingAbilityId: 4,
            spellRules: { multiClassSpellSlotDivisor: 1 },
          },
        },
      ],
    });

    expect(character.spellcasting).toMatchObject({
      slots: [4, 3, 3, 2],
      profiles: [
        { source: 'Cleric', ability: 'WIS', modifier: 4, attack: 7, saveDc: 15 },
        { source: 'Wizard', ability: 'INT', modifier: 2, attack: 5, saveDc: 13 },
      ],
    });
  });

  it('expresses partial rest recovery and alternative costs without losing the original rules', () => {
    const character = normalizeCharacter({
      ...base,
      actions: { class: [{ name: 'Guardian Reserve',
        limitedUse: { maxUses: 3, resetType: 2 },
        description: 'You regain one expended use when you finish a Short Rest and all uses after a Long Rest. ' +
          'You can regain one expended use by expending a spell slot.',
      }] },
    });
    expect(character.actions[0].resource).toMatchObject({
      max: 3, recharge: 'SR1_LR',
      recovery: { kind: 'partial-short-full-long', shortRestUses: 1 },
      alternateRecovery: [{ restores: 1, cost: '1 spell slot' }],
    });
    expect(character.actions[0].summary).toContain('spell slot');
  });

  it('does not merge two different recoveries from the same feature', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 101, name: 'Dual Gift' } }],
      spells: { feat: [
        { componentId: 101, definition: { name: 'Ward', level: 1 }, limitedUse: { maxUses: 1, resetType: 1 } },
        { componentId: 101, definition: { name: 'Ward', level: 1 }, limitedUse: { maxUses: 1, resetType: 2 } },
      ] },
    });
    expect(character.spells[0].featureUses).toMatchObject([
      { source: 'Dual Gift', pool: { max: 1, recharge: 'SR' } },
      { source: 'Dual Gift', pool: { max: 1, recharge: 'LR' } },
    ]);
  });

  it('separates material and higher-slot rules without printing them twice', () => {
    const character = normalizeCharacter({
      ...base,
      spells: { class: [{ spellCastingAbilityId: 4, definition: {
        name: 'Crystal Ward', level: 1, components: [1, 3],
        componentsDescription: 'a crystal worth 50 GP, consumed',
        description: '<p>Protect one creature.</p><p><strong>Using a Higher-Level Spell Slot.</strong> ' +
          'Protect one additional creature for each extra slot level.</p>',
      } }] },
    });
    expect(character.spells[0]).toMatchObject({
      ability: 'INT', summary: 'Protect one creature.',
      material: 'a crystal worth 50 GP, consumed',
      upcast: 'Protect one additional creature for each extra slot level.',
    });
  });

  it('puts mandatory casting focus rules on the matching class profile', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', spellCastingAbilityId: 4,
        classFeatures: [{ id: 10, name: 'Spellcasting',
          description: '<p><strong><em>Tools Required.</em></strong> You must hold tools; every spell has a Material component.</p>',
        }],
      } }],
    });
    expect(character.spellcasting?.profiles?.[0].focus).toBe('You must hold tools; every spell has a Material component.');
    expect(character.features.flatMap((group) => group.items).find((item) => item.name === 'Spellcasting')?.parts)
      .toContainEqual({ label: 'Tools Required', text: '', reference: 'spells' });
  });

  it('applies a selected class-specific casting bonus only to that class profile', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [
        { level: 3, definition: { name: 'Cleric', spellCastingAbilityId: 5, classFeatures: [{ id: 10, name: 'Empowered Casting' }] } },
        { level: 3, definition: { name: 'Wizard', spellCastingAbilityId: 4 } },
      ],
      options: { class: [{ componentId: 10, definition: { id: 11, name: 'Activate Empowered Casting' } }] },
      modifiers: { class: [{ type: 'bonus', subType: 'cleric-spell-save-dc', value: 1, componentId: 11 }] },
    });
    expect(character.spellcasting?.profiles).toMatchObject([
      { source: 'Cleric', saveDc: 16 }, { source: 'Wizard', saveDc: 13 },
    ]);
    expect(character.spellcasting?.saveDc).toBe(16);
  });
});
