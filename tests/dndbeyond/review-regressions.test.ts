import { describe, expect, it } from 'vitest';
import type { RawCharacter } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

const base: RawCharacter = {
  id: 1,
  name: 'Review fixture',
  classes: [{ level: 5, definition: { name: 'Cleric', spellCastingAbilityId: 5 } }],
  stats: [{ id: 5, name: 'Wisdom', value: 18 }],
};

describe('normalization review regressions', () => {
  it.each([
    ['(classlevel/2)@rounddown#signed', '1d6+10'],
    ['(0-classlevel)#signed', '1d6-20'],
    ['(classlevel-classlevel)#signed', '1d6+0'],
  ])('resolves explicitly signed arithmetic beside dice: %s', (expression, expected) => {
    const { actions } = normalizeCharacter({
      ...base,
      classes: [{ level: 20, definition: { name: 'Barbarian' } }],
      actions: { class: [{
        name: 'Fury pulse',
        description: `Deal 1d6{{${expression}}} extra damage.`,
      }] },
    });
    expect(actions[0].summary).toBe(`Deal ${expected} extra damage.`);
  });

  it('preserves full action rules instead of replacing them with a short snippet', () => {
    const rules = 'The target can repeat the saving throw at the end of each turn. ';
    const { actions } = normalizeCharacter({
      ...base,
      actions: { class: [{
        name: 'Binding Light',
        snippet: 'Bind a target.',
        description: `<p>As an Action, choose a target.</p><p>${rules.repeat(10)}</p><p>The effect ends if you are incapacitated.</p>`,
        activation: { activationType: 1 },
      }] },
    });
    expect(actions[0].summary).toContain(rules.repeat(10).trim());
    expect(actions[0].summary).toContain('The effect ends if you are incapacitated.');
  });

  it('does not refer a feature to an action with no rules text', () => {
    const { features } = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { classFeatures: [{
        id: 20, name: 'Binding Light', description: 'The target is restrained for one minute.',
      }] } }],
      actions: { class: [{ name: 'Binding Light', activation: { activationType: 1 } }] },
    });
    expect(features[0].items[0].summary).toContain('restrained for one minute');
  });

  it('filters future-level actions and spells while keeping selected option grants', () => {
    const { actions, spells } = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { classFeatures: [
        { id: 20, name: 'Present', requiredLevel: 1 },
        { id: 30, name: 'Future', requiredLevel: 10 },
      ] } }],
      options: { class: [{ componentId: 20, definition: { id: 40, name: 'Selected' } }] },
      actions: { class: [
        { name: 'Future action', componentId: 30, componentTypeId: 12168134 },
        { name: 'Selected action', componentId: 40, componentTypeId: 12168134 },
      ] },
      spells: { class: [
        { definition: { name: 'Future spell', level: 1 }, componentId: 30, componentTypeId: 12168134 },
        { definition: { name: 'Selected spell', level: 1 }, componentId: 40, componentTypeId: 12168134 },
      ] },
    });
    expect(actions.map(({ name }) => name)).toEqual(['Selected action']);
    expect(spells.map(({ name }) => name)).toEqual(['Selected spell']);
  });

  it('uses an ability modifier when resolving limited uses on actions and spells', () => {
    const limitedUse = { maxUses: 1, statModifierUsesId: 5, resetType: 2 };
    const { actions, spells } = normalizeCharacter({
      ...base,
      actions: { class: [{ name: 'Ward', limitedUse }] },
      spells: { feat: [{ definition: { name: 'Protection', level: 1 }, limitedUse }] },
    });
    expect(actions[0].resource).toMatchObject({ max: 5, recharge: 'LR' });
    expect(spells[0].uses).toEqual({ max: 5, recharge: 'LR' });
  });

  it('adds proficiency-scaled uses to a fixed pool and ignores spent uses for print', () => {
    const { actions } = normalizeCharacter({
      ...base,
      actions: { class: [{ name: 'Ward', limitedUse: {
        maxUses: 2, useProficiencyBonus: true, numberUsed: 4, resetType: 1,
      } }] },
    });
    expect(actions[0].resource).toMatchObject({ max: 5, recharge: 'SR' });
  });

  it('includes fixed action damage bonuses and floors unarmed damage at zero', () => {
    const { actions, attacks } = normalizeCharacter({
      ...base,
      stats: [{ id: 1, name: 'Strength', value: 3 }, ...base.stats!],
      actions: { class: [{
        name: 'Radiant pulse', dice: { diceString: '2d6', fixedValue: 2 },
        damageBonus: 3, abilityModifierStatId: 5, damageTypeId: 9,
      }] },
    });
    expect(actions[0].damage).toMatchObject({ dice: '2d6', bonus: 9 });
    expect(attacks.find(({ name }) => name === 'Unarmed Strike')?.damage?.bonus).toBe(0);
  });

  it('merges prepared state and counts deduplicated spells', () => {
    const { spells, sections } = normalizeCharacter({
      ...base,
      classSpells: [{ spells: [
        { definition: { name: 'Ward', level: 1 } },
        { definition: { name: 'Ward', level: 1 }, prepared: true },
      ] }],
    });
    expect(spells).toHaveLength(1);
    expect(spells[0].prepared).toBe(true);
    expect(sections.find(({ key }) => key === 'spells')?.count).toBe(1);
  });

  it('keeps complete spell rules with separate higher-slot and material fields', () => {
    const { spells } = normalizeCharacter({
      ...base,
      spells: { class: [{ definition: {
        name: 'Ward', level: 1, snippet: 'Protect a creature.',
        components: [1, 3], componentsDescription: 'a gem worth 100 GP, consumed',
        description: `<p>${'The ward lasts for one minute. '.repeat(20)}</p><p>Using a Higher-Level Spell Slot: choose one additional creature.</p>`,
      } }] },
    });
    expect(spells[0].upcast).toContain('choose one additional creature');
    expect(spells[0].material).toContain('a gem worth 100 GP, consumed');
    expect(spells[0].summary).toContain('The ward lasts for one minute.');
  });

  it('retains nonwalking speeds and exhaustion levels from the API', () => {
    const { basics } = normalizeCharacter({
      ...base,
      race: { weightSpeeds: { normal: { walk: 30, fly: 50, swim: 30 } } },
      conditions: [{ id: 4, level: 2 }],
    });
    expect(basics.specialSpeeds).toEqual([{ label: 'Fly', value: 50 }, { label: 'Swim', value: 30 }]);
    expect(basics.conditionLevels).toEqual({ Exhaustion: 2 });
  });

  it('uses unarmored ability bonuses and granted hit points per level', () => {
    const { basics } = normalizeCharacter({
      ...base,
      baseHitPoints: 20,
      modifiers: { class: [
        { type: 'set', subType: 'unarmored-armor-class', statId: 5 },
        { type: 'bonus', subType: 'hit-points-per-level', value: 1 },
      ] },
    });
    expect(basics.armorClass).toBe(14);
    expect(basics.hitPoints.max).toBe(25);
  });

  it('chooses the best unarmored formula without adding it to worn armor', () => {
    const character = {
      ...base,
      modifiers: { class: [
        { type: 'set', subType: 'unarmored-armor-class', statId: 5 },
        { type: 'set', subType: 'unarmored-armor-class', value: 3 },
      ] },
    };
    expect(normalizeCharacter(character).basics.armorClass).toBe(14);
    expect(normalizeCharacter({
      ...character,
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 3, armorClass: 18 } }],
    }).basics.armorClass).toBe(18);
  });

  it('includes granted spell attack bonuses', () => {
    const { spellcasting } = normalizeCharacter({
      ...base,
      modifiers: { item: [{ type: 'bonus', subType: 'spell-attacks', value: 1 }] },
    });
    expect(spellcasting?.attack).toBe(8);
  });

  it('honors ability-setting effects without lowering stronger scores or overriding manual values', () => {
    const character = {
      ...base,
      modifiers: { item: [{ type: 'set', subType: 'wisdom-score', value: 19 }] },
    };
    expect(normalizeCharacter(character).abilities.find(({ key }) => key === 'wis')?.score).toBe(19);
    expect(normalizeCharacter({
      ...character, stats: [{ id: 5, name: 'Wisdom', value: 20 }],
    }).abilities.find(({ key }) => key === 'wis')?.score).toBe(20);
    expect(normalizeCharacter({
      ...character, overrideStats: [{ id: 5, name: 'Wisdom', value: 14 }],
    }).abilities.find(({ key }) => key === 'wis')?.score).toBe(14);
  });

  it('resolves class-level and scale placeholders against the granting class', () => {
    const { actions, features } = normalizeCharacter({
      ...base,
      classes: [
        { level: 2, definition: { name: 'Cleric' }, classFeatures: [{
          levelScale: { level: 2, dice: { diceString: '2d6' } },
          definition: { id: 20, name: 'Sacred Gift', description: 'Use {{classlevel}} and {{scalevalue}}; proficiency {{proficiency}}.' },
        }] },
        { level: 8, definition: { name: 'Fighter' } },
      ],
      actions: { class: [{
        name: 'Gift pulse', componentId: 20, componentTypeId: 12168134,
        description: 'Use {{classlevel}} and {{scalevalue}}; proficiency {{proficiency}}.',
      }] },
    });
    expect(actions[0].summary).toBe('Use 2 and 2d6; proficiency 4.');
    expect(features[0].items[0].reference).toBe('actions');
  });

  it('preserves essential rules-table cells in the printable table section', () => {
    const { spells, ruleTables } = normalizeCharacter({
      ...base, spells: { class: [{ definition: {
        name: 'Random Gift', level: 1,
        description: '<p>Roll a d6.</p><table><tr><th>Roll</th><th>Effect</th></tr><tr><td>1–3</td><td>Recover 2d6 HP.</td></tr></table>',
      } }] },
    });
    expect(ruleTables?.[0].rows).toEqual([['1–3', 'Recover 2d6 HP.']]);
    expect(spells[0].related).toContain('tables');
    expect(spells[0].summary).not.toContain('<td>');
  });

  it('combines independent free-cast grants but not duplicate records of one grant', () => {
    const cast = { definition: { name: 'Ward', level: 1 }, limitedUse: { maxUses: 1, resetType: 2 } };
    const { spells } = normalizeCharacter({
      ...base, spells: { feat: [
        { ...cast, componentId: 20 }, { ...cast, componentId: 20 }, { ...cast, componentId: 30 },
      ] },
    });
    expect(spells[0].uses).toEqual({ max: 2, recharge: 'LR' });
  });

  it('respects multiplicative resource operators', () => {
    const { actions } = normalizeCharacter({
      ...base, actions: { class: [{
        name: 'Scaled pool',
        limitedUse: { maxUses: 2, useProficiencyBonus: true, proficiencyBonusOperator: 2 },
      }] },
    });
    expect(actions[0].resource?.max).toBe(6);
  });

  it('retains fixed weapon and action damage without inventing a die', () => {
    const { attacks, actions } = normalizeCharacter({
      ...base,
      inventory: [{ id: 1, equipped: true, definition: {
        name: 'Blowgun', filterType: 'Weapon', fixedDamage: 1, damageType: 'Piercing',
      } }],
      actions: { class: [{ name: 'Flat pulse', value: 5, damageTypeId: 12 }] },
    });
    expect(attacks[0].damage).toEqual({ dice: '', bonus: 1, type: 'Piercing' });
    expect(actions[0].damage).toEqual({ dice: '', bonus: 5, type: 'Radiant' });
  });

  it('shows every selected benefit when a feature allows multiple choices', () => {
    const { features } = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { classFeatures: [{ id: 20, name: 'Techniques' }] } }],
      options: { class: [
        { componentId: 20, definition: { id: 30, name: 'Precise', snippet: 'Reroll one attack.' } },
        { componentId: 20, definition: { id: 40, name: 'Guarded', snippet: 'Protect one ally.' } },
      ] },
    });
    const items = features.flatMap(({ items }) => items);
    expect(items).toContainEqual({ name: 'Precise', summary: 'Reroll one attack.' });
    expect(items).toContainEqual({ name: 'Guarded', summary: 'Protect one ally.' });
    expect(items.some(({ name }) => name === 'Techniques')).toBe(false);
  });

  it('filters grants from unselected option entity types', () => {
    const { actions, spells } = normalizeCharacter({
      ...base,
      actions: { class: [{ name: 'Unselected action', componentId: 99, componentTypeId: 258900837 }] },
      spells: { race: [{ definition: { name: 'Unselected spell', level: 1 }, componentId: 99, componentTypeId: 306912077 }] },
    });
    expect(actions).toEqual([]);
    expect(spells).toEqual([]);
  });

  it('shows custom tool proficiencies and keeps their section visible', () => {
    const { proficiencies, sections } = normalizeCharacter({
      ...base,
      customProficiencies: [
        { type: 2, name: "Cartographer's Tools" },
        { type: 2, name: "Glassblower's Tools" },
        { type: 2, name: "Navigator's Tools" },
      ],
    });
    expect(proficiencies.tools).toEqual([
      "Cartographer's Tools", "Glassblower's Tools", "Navigator's Tools",
    ]);
    expect(sections.find(({ key }) => key === 'proficiencies')).toMatchObject({
      count: 3, isEmpty: false,
    });
  });

  it('merges custom tools and languages without duplicating grants or counting custom skills', () => {
    const { proficiencies, sections } = normalizeCharacter({
      ...base,
      modifiers: { class: [{
        type: 'proficiency', subType: 'navigators-tools', friendlySubtypeName: "Navigator's Tools",
      }] },
      customProficiencies: [
        { type: 2, name: " Navigator's Tools " },
        { type: 3, name: 'Dwarvish' },
        { type: 3, name: '  ' },
        { type: 1, name: 'Arcana' },
      ],
    });
    expect(proficiencies.tools).toEqual(["Navigator's Tools"]);
    expect(proficiencies.languages).toEqual(['Dwarvish']);
    expect(sections.find(({ key }) => key === 'proficiencies')?.count).toBe(2);
  });
});
