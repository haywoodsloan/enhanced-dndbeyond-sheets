import { describe, expect, it } from 'vitest';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';
import type { RawCharacter } from '@/services/dndbeyond/api-types';

const base: RawCharacter = { id: 1, name: 'Owned rules', stats: [], classes: [] };
const items = (raw: RawCharacter) => normalizeCharacter(raw).features.flatMap((group) => group.items);

describe('complete owned rules', () => {
  it('hides origin catalog feats despite descriptions or cached selected options', () => {
    const result = items({
      ...base,
      feats: [
        { definition: { id: 10, name: 'Hidden origin', categories: [{ tagName: '__DISGUISE_FEAT' }] } },
        { definition: { id: 20, name: 'Circle rite', categories: [{ tagName: '__DISGUISE_FEAT' }],
          description: '<p>Maintain Concentration until every participant finishes.</p>' } },
        { definition: { id: 30, name: 'Empty origin', categories: [{ tagName: '__DISGUISE_FEAT' }] } },
      ],
      options: { feat: [{ componentId: 10, definition: {
        id: 11, name: 'Moon bargain', snippet: 'Transform once per Long Rest.',
        description: '<p>You can transform once per Long Rest but can target only yourself.</p>' +
          '<p><strong><em>Silver weakness.</em></strong> Touching silver prevents healing until a Short or Long Rest.</p>',
      } }] },
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain('Moon bargain');
    expect(text).not.toContain('prevents healing');
    expect(text).not.toContain('Circle rite');
    expect(text).not.toContain('Empty origin');
  });

  it('keeps explicit hidden-origin free-cast restrictions on the spell, not as a global feat', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Hidden origin', categories: [{ tagName: '__DISGUISE_FEAT' }] } }],
      options: { feat: [{ componentId: 10, definition: { id: 11, name: 'Moon gift',
        description: '<p><strong><em>Moon Ward.</em></strong> You can cast Shared Ward once without a slot, targeting only yourself.</p>' +
          '<p><strong><em>Silver weakness.</em></strong> Touching silver prevents healing.</p>',
      } }] },
      spells: { feat: [{ componentId: 11, componentTypeId: 258900837, limitedUse: { maxUses: 1, resetType: 2 },
        definition: { name: 'Shared Ward', level: 1, description: '<p>Protect a creature.</p>' },
      }] },
    });
    expect(character.features).toEqual([]);
    expect(character.spells[0].summary).toContain('targeting only yourself');
    expect(character.spells[0].summary).not.toContain('Silver weakness');
  });

  it('allows a tagged feat when an actual selected feat choice explicitly names its definition', () => {
    const result = items({
      ...base,
      feats: [{ definition: { id: 20, name: 'Chosen rite', categories: [{ tagName: '__DISGUISE_FEAT' }],
        description: '<p>Protect an ally.</p>' } }],
      choices: { feat: [{ optionValue: 20 }] },
    });
    expect(result).toContainEqual({ name: 'Chosen rite', summary: 'Protect an ally.' });
  });

  it.each([16, 20])('retains distinct same-name upgrades only at their owned level (%i)', (level) => {
    const result = items({
      ...base,
      classes: [{ level, definition: { name: 'Warrior' }, classFeatures: [
        { definition: { id: 10, name: 'Improved Strike', requiredLevel: 13,
          description: '<p>You can stagger a target.</p>' } },
        { definition: { id: 20, name: 'Improved Strike', requiredLevel: 17, hideInSheet: true,
          description: '<p>You can apply two different effects to the same strike.</p>' } },
        { definition: { id: 10, name: 'Improved Strike', requiredLevel: 13,
          description: '<p>You can stagger a target.</p>' } },
      ] }],
    });
    const text = JSON.stringify(result);
    expect(text.match(/stagger a target/g)).toHaveLength(1);
    expect(text.includes('two different effects')).toBe(level >= 17);
  });

  it('does not confuse separate selected benefits behind identical choice prompts', () => {
    const result = items({
      ...base,
      classes: [{ level: 5, definition: { name: 'Warrior', classFeatures: [
        { id: 10, name: 'Training', description: '<p>Choose a style.</p>' },
        { id: 20, name: 'Training', description: '<p>Choose a style.</p>' },
      ] } }],
      options: { class: [
        { componentId: 10, definition: { id: 11, name: 'Accurate', snippet: 'Reroll a missed attack.' } },
        { componentId: 20, definition: { id: 21, name: 'Guarded', snippet: 'Protect an adjacent ally.' } },
      ] },
    });
    expect(result.map((item) => item.name)).toEqual(['Accurate', 'Guarded']);
  });

  it('keeps exact names of selected textless item plans without catalog options', () => {
    const result = items({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [{
        id: 10, name: 'Item Plans', description: '<p>You can create an item using your plans.</p>',
      }] } }],
      options: { class: [
        { componentId: 10, definition: { id: 11, name: 'Silver Compass', snippet: null,
          description: '<p>This is a generated Class Feature Option: Item Plans</p>' } },
        { componentId: 10, definition: { id: 12, name: 'Clockwork Ring', snippet: null } },
      ] },
      choices: { choiceDefinitions: [{ options: [{ id: 13, label: 'Unselected Lantern' }] }] },
    });
    const text = JSON.stringify(result);
    expect(text).toContain('Silver Compass');
    expect(text).toContain('Clockwork Ring');
    expect(text).toContain('create an item');
    expect(text).not.toContain('Unselected Lantern');
    expect(text).not.toContain('generated Class Feature');
  });

  it('keeps casting requirements and operative prose mentioning tables', () => {
    const result = items({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [{
        id: 10, name: 'Spellcasting',
        description: '<p>You can cast spells.</p><p><strong><em>Tools Required.</em></strong>' +
          'You must hold proficient tools, adding a Material component to every spell.</p>' +
          '<p><strong><em>Preparing Spells.</em></strong> After a Long Rest choose the number in the class table.</p>',
      }] } }],
    });
    const text = JSON.stringify(result);
    expect(text).toContain('must hold proficient tools');
    expect(text).toContain('Material component');
    expect(text).toContain('After a Long Rest choose the number');
  });

  it('preserves unique trailing creation rules after a duplicated action part', () => {
    const revival = 'Expend a spell slot to restore your helper after one minute.';
    const result = items({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [{
        id: 10, name: 'Metal Helper', description: '<p>Your helper follows you.</p>' +
          `<p><strong><em>Restoring Helper.</em></strong> ${revival}</p>` +
          '<p>After a Long Rest create a new helper. The first helper vanishes.</p>',
      }] } }],
      actions: { class: [{ componentId: 10, name: 'Restoring Helper', description: revival,
        activation: { activationType: 1 } }] },
    });
    expect(JSON.stringify(result)).toContain('first helper vanishes');
    expect(JSON.stringify(result)).not.toContain(revival);
  });

  it('retains bullet mechanics between paragraphs and after a table', () => {
    const result = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Prepared mixtures', description:
        '<p>Choose one mixture as a Magic action using the table.</p>' +
        '<ul><li><strong>Quick.</strong> Move 10 feet.</li><li><strong>Safe.</strong> Prevent a fall.</li></ul>' +
        '<table><tr><th>Tool</th><th>Result</th></tr><tr><td>Kit</td><td>Smoke</td></tr></table>' +
        '<p>The mixture expires after a Long Rest.</p>',
      } }],
    });
    const text = JSON.stringify(result.features);
    expect(text).toContain('Magic action');
    expect(text).toContain('Move 10 feet');
    expect(text).toContain('Prevent a fall');
    expect(text).toContain('expires after a Long Rest');
    expect(result.ruleTables).toEqual(expect.arrayContaining([
      expect.objectContaining({ columns: ['Tool', 'Result'], rows: [['Kit', 'Smoke']] }),
    ]));
    expect(text).not.toContain('Smoke');
  });

  it('moves duplicated companion stat blocks out of both actions and features exactly once', () => {
    const block = '<div class="stat-block"><h3>Brass Helper</h3><p><em>Small Construct</em></p>' +
      '<p><strong>Armor Class</strong> 14</p><p><strong>Hit Points</strong> 20 (Hit Dice [d8s])</p>' +
      '<p><strong>Speed</strong> 25 ft.</p><table><tr><th>STR</th><td>12</td><td>+1</td><td>+3</td></tr></table>' +
      '<p><strong>Actions</strong></p><p><strong>Patch.</strong> Repair 1d8 damage.</p></div>';
    const result = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Brass Bond', description: '<p>Create a helper.</p>' + block } }],
      actions: { feat: [{ name: 'Brass Bond', componentId: 10, description: '<p>Create a helper.</p>' + block,
        activation: { activationType: 1 } }] },
    });
    expect(result.companions).toHaveLength(1);
    expect(result.companions?.[0].hitPoints).toContain('d8s');
    expect(result.companions?.[0]).toMatchObject({
      name: 'Brass Helper', abilities: [{ key: 'STR', score: '12', modifier: '+1', save: '+3' }],
      details: expect.arrayContaining([{ section: 'Actions', label: 'Patch', text: 'Repair 1d8 damage.' }]),
    });
    expect(JSON.stringify([result.features, result.actions])).not.toContain('Repair 1d8 damage');
    expect(result.ruleTables ?? []).toHaveLength(0);
  });

  it('lists actually granted spells on the owning selected benefit', () => {
    const result = items({
      ...base,
      feats: [{ definition: { id: 10, name: 'Moon gift' } }],
      options: { feat: [{ componentId: 10, definition: {
        id: 11, name: 'Silver Ward', snippet: 'You gain protective magic.',
      } }] },
      spells: { feat: [
        { componentId: 11, componentTypeId: 258900837, definition: { name: 'Moon Shield', level: 1 } },
        { componentId: 12, componentTypeId: 258900837, definition: { name: 'Unselected Spell', level: 1 } },
      ] },
    });
    expect(result.find((item) => item.name === 'Silver Ward')?.grantedSpells).toEqual(['Moon Shield']);
  });

  it('retains selected Extras with their source, maximum HP, saves, and actions', () => {
    const result = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Keeper', classFeatures: [{
        id: 10, name: 'Bonded Companion', creatureRules: [{ creatureGroupId: 3 }],
      }] } }],
      creatures: [{
        name: 'Iron Tortoise', groupId: 3, removedHitPoints: 10,
        definition: {
          name: 'Tortoise', armorClass: 17, averageHitPoints: 30,
          movements: [{ movementId: 1, speed: 20 }],
          stats: [{ statId: 1, value: 14 }], savingThrows: [{ statId: 1, bonus: 4 }],
          actionsDescription: '<p><strong>Bite.</strong> Deal 1d6 damage.</p>',
        },
      }],
    });
    expect(result.companions).toContainEqual(expect.objectContaining({
      name: 'Iron Tortoise', source: 'Bonded Companion', armorClass: '17', hitPoints: '30', speed: '20 ft.',
      abilities: [{ key: 'STR', score: '14', modifier: '+2', save: '+4' }],
      details: expect.arrayContaining([{ section: 'Actions', label: 'Bite', text: 'Deal 1d6 damage.' }]),
    }));
  });
});
