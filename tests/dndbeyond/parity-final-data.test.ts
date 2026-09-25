import { describe, expect, it } from 'vitest';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';
import type { RawCharacter } from '@/services/dndbeyond/api-types';

const base: RawCharacter = { id: 1, name: 'Final data fixture', stats: [], classes: [] };

describe('final playable data regressions', () => {
  it('retains shared choice requirements without restoring unselected option descriptions', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [{
        id: 10, name: 'Equipment Model', description:
          '<p>You use Intelligence for the model weapon.</p>' +
          '<p>You can change the model after a Short or Long Rest with smith tools in hand.</p>' +
          '<p><strong><em>Guardian.</em></strong> Guard one ally.</p>' +
          '<p><strong><em>Scout.</em></strong> Gain unselected scouting powers.</p>',
      }] } }],
      options: { class: [{ componentId: 10, definition: { id: 11, name: 'Guardian', snippet: 'Guard one ally.' } }] },
    });
    const text = JSON.stringify(character.features);
    expect(text).toContain('Intelligence for the model weapon');
    expect(text).toContain('Short or Long Rest with smith tools');
    expect(text).toContain('Guard one ally');
    expect(text).not.toContain('unselected scouting powers');
  });

  it('keeps both class-specific casting profiles when one spell name is merged', () => {
    const character = normalizeCharacter({
      ...base,
      stats: [{ id: 4, name: 'Intelligence', value: 14 }, { id: 5, name: 'Wisdom', value: 18 }],
      classes: [
        { id: 100, level: 3, definition: { name: 'Wizard', spellCastingAbilityId: 4 } },
        { id: 200, level: 3, definition: { name: 'Cleric', spellCastingAbilityId: 5 } },
      ],
      classSpells: [
        { characterClassId: 100, spells: [{ definition: { name: 'Hold Person', level: 2 } }] },
        { characterClassId: 200, spells: [{ definition: { name: 'Hold Person', level: 2 } }] },
        { characterClassId: 200, spells: [{ definition: { name: 'Hold Person', level: 2 } }] },
      ],
    });
    expect(character.spells).toHaveLength(1);
    expect(character.spells[0]).toMatchObject({ castingSources: [
      { source: 'Wizard', ability: 'INT', modifier: 2, attack: 5, saveDc: 13 },
      { source: 'Cleric', ability: 'WIS', modifier: 4, attack: 7, saveDc: 15 },
    ] });
  });

  it('retains a different casting ability on an independent free-cast grant', () => {
    const character = normalizeCharacter({
      ...base,
      stats: [{ id: 4, name: 'Intelligence', value: 14 }, { id: 5, name: 'Wisdom', value: 18 }],
      classes: [{ id: 100, level: 6, definition: { name: 'Wizard', spellCastingAbilityId: 4 } }],
      classSpells: [{ characterClassId: 100, spells: [{ definition: { name: 'Ward', level: 1 } }] }],
      feats: [{ definition: { id: 10, name: 'Nature Gift' } }],
      spells: { feat: [{ componentId: 10, spellCastingAbilityId: 5, limitedUse: { maxUses: 1, resetType: 2 },
        definition: { name: 'Ward', level: 1 },
      }] },
    });
    expect(character.spells[0]).toMatchObject({
      castingSources: [
        { source: 'Wizard', ability: 'INT', saveDc: 13 },
        { source: 'Nature Gift', ability: 'WIS', saveDc: 15 },
      ],
      featureUses: [{ source: 'Nature Gift', pool: { max: 1, recharge: 'LR' } }],
    });
  });

  it.each([20, 22])('inherits class casting stats for a null-ability feature or nested option grant (%i)', (componentId) => {
    const character = normalizeCharacter({
      ...base,
      stats: [{ id: 4, name: 'Intelligence', value: 14 }, { id: 6, name: 'Charisma', value: 18 }],
      classes: [
        { id: 100, level: 3, definition: { name: 'Wizard', spellCastingAbilityId: 4 } },
        { id: 200, level: 3, definition: { name: 'Sorcerer', spellCastingAbilityId: 6 },
          classFeatures: [{ definition: { id: 20, name: 'Psionic Spells' } }] },
      ],
      classSpells: [{ characterClassId: 100, spells: [{ definition: { name: 'Detect Thoughts', level: 2 } }] }],
      options: { class: [
        { componentId: 20, definition: { id: 21, name: 'Psychic Selection' } },
        { componentId: 21, definition: { id: 22, name: 'Telepathic Selection' } },
      ] },
      modifiers: { class: [{ type: 'bonus', subType: 'sorcerer-spell-attacks', value: 1 }] },
      spells: { class: [{
        componentId, componentTypeId: componentId === 20 ? 12168134 : 258900837,
        spellCastingAbilityId: null, definition: { name: 'Detect Thoughts', level: 2 },
      }] },
    });
    expect(character.spells).toHaveLength(1);
    expect(character.spells[0].castingSources).toMatchObject([
      { source: 'Wizard', ability: 'INT', modifier: 2, attack: 5, saveDc: 13 },
      { source: 'Sorcerer', ability: 'CHA', modifier: 4, attack: 8, saveDc: 15 },
    ]);
  });

  it('uses six effective leaf headers for a two-plus-four grouped table', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Casting progression', description:
        '<table><thead><tr><th colspan="2"></th><th colspan="4">Spell Slots per Spell Level</th></tr>' +
        '<tr><th>Level</th><th>Known</th><th>1st</th><th>2nd</th><th>3rd</th><th>4th</th></tr></thead>' +
        '<tbody><tr><td>20</td><td>13</td><td>4</td><td>3</td><td>3</td><td>1</td></tr></tbody></table>',
      } }],
    });
    expect(character.ruleTables?.[0]).toMatchObject({
      columns: ['Level', 'Known', '1st', '2nd', '3rd', '4th'],
      rows: [['20', '13', '4', '3', '3', '1']],
    });
  });

  it('preserves rowspan associations without printing header rows as results', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Paired progression', description:
        '<table><thead><tr><th rowspan="2">Level</th><th colspan="2">Uses</th></tr>' +
        '<tr><th>Short Rest</th><th>Long Rest</th></tr></thead><tbody>' +
        '<tr><td rowspan="2">5</td><td>1</td><td>2</td></tr><tr><td>2</td><td>3</td></tr></tbody></table>',
      } }],
    });
    expect(character.ruleTables?.[0]).toMatchObject({
      columns: ['Level', 'Short Rest', 'Long Rest'],
      rows: [['5', '1', '2'], ['5', '2', '3']],
    });
  });

  const companion = (hp: number, separate: boolean, extra = '') =>
    '<div class="stat-block"><h3>Land Companion</h3><p>Medium Beast</p>' +
    `<p><strong>AC</strong> 15</p><p><strong>HP</strong> ${hp}</p><p><strong>Speed</strong> 40 ft.</p>` +
    '<p><strong>Actions</strong></p><p><strong>Strike.</strong> Deal 1d8 damage.' +
    (separate ? '</p><p>' : ' ') + 'After moving 20 feet, knock the target prone.</p>' + extra + '</div>';

  it('merges paragraph-layout duplicates while retaining additional trailing riders', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Companion Bond',
        description: companion(25, true, '<p>The companion can carry its rider.</p>'),
      } }],
      actions: { feat: [{ name: 'Companion Bond', componentId: 10, description: companion(25, false) }] },
    });
    expect(character.companions).toHaveLength(1);
    const text = JSON.stringify(character.companions);
    expect(text.match(/knock the target prone/g)).toHaveLength(1);
    expect(text).toContain('can carry its rider');
  });

  it('keeps same-name companion variants with different statistics separate', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: { id: 10, name: 'Companion Bond', description: companion(25, false) + companion(40, true) } }],
    });
    expect(character.companions).toHaveLength(2);
    expect(character.companions?.map((entry) => entry.hitPoints).sort()).toEqual(['25', '40']);
  });
});
