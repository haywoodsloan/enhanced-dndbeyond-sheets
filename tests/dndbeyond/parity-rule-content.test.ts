import { describe, expect, it } from 'vitest';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';
import type { RawCharacter } from '@/services/dndbeyond/api-types';

const base: RawCharacter = {
  id: 1,
  name: 'Rule content fixture',
  classes: [{ level: 20, definition: { name: 'Artificer' } }],
  stats: [],
};

describe('playable rule content parity', () => {
  it('does not extract tables from structural or above-level class features', () => {
    const table = '<table><tr><th>Trait</th><th>Choice</th></tr><tr><td>Training</td><td>Unused catalog entry</td></tr></table>';
    const character = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [
        { id: 10, name: 'Core Maker Traits', description: table },
        { id: 11, name: 'Future Technique', requiredLevel: 10, description: table },
      ] } }],
    });
    expect(character.ruleTables).toEqual([]);
    expect(JSON.stringify(character.features)).not.toContain('Unused catalog entry');
  });

  it('uses selected language proficiencies instead of extracting the language catalog', () => {
    const character = normalizeCharacter({
      ...base,
      race: { racialTraits: [{ definition: { id: 10, name: 'Languages',
        description: '<p>Choose two languages.</p><table><caption>Standard Languages</caption>' +
          '<tr><th>Language</th></tr><tr><td>Unselected Language</td></tr></table>',
      } }] },
      modifiers: { race: [{ type: 'language', friendlySubtypeName: 'Common' }] },
    });
    expect(character.proficiencies.languages).toContain('Common');
    expect(character.ruleTables).toEqual([]);
    expect(JSON.stringify(character.features)).not.toContain('Unselected Language');
  });

  it('deduplicates a feature/action lookup with DDB reference aliases and different source labels', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [{
        id: 10, name: 'Workshop Crafting',
        description: '<table><tr><th>Item</th></tr><tr><td>Spikes, Iron</td></tr></table>',
      }] } }],
      actions: { class: [{ name: 'Create a Supply', componentId: 10,
        description: '<table><tr><th>ITEM</th></tr><tr><td>[items]Iron Spikes;Spikes, Iron[/items]</td></tr></table>',
      }] },
    });
    expect(character.ruleTables).toHaveLength(1);
    expect(character.ruleTables?.[0].rows).toEqual([['Spikes, Iron']]);
  });

  it('limits a known-plan catalog to selected rows while retaining exact chosen names', () => {
    const character = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Maker', classFeatures: [
        { id: 10, name: 'Item Plans', description: '<p>Your learned plans.</p>' },
        { id: 11, name: 'Replicate Item', description:
          '<p>Create one of your known plans after a Long Rest.</p><table><caption>Item Plans (Level 2+)</caption>' +
          '<tr><th>Plan</th><th>Attunement</th></tr><tr><td>Silver Compass</td><td>No</td></tr>' +
          '<tr><td>Unselected Crown</td><td>Yes</td></tr></table>',
        },
      ] } }],
      options: { class: [{ componentId: 10, definition: { id: 101, name: 'Silver Compass', snippet: null } }] },
    });
    expect(character.ruleTables?.[0].rows).toEqual([['Silver Compass', 'No']]);
    expect(JSON.stringify(character.features)).toContain('Silver Compass');
    expect(JSON.stringify(character)).not.toContain('Unselected Crown');
  });

  it('retains a passive feature rule after a long introduction', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: {
        id: 101,
        name: 'Patient Guardian',
        description: `<p>${'This benefit remains available while the guardian is nearby. '.repeat(12)}</p>` +
          '<p>At the end of the effect, regain 2d6 hit points and move up to 30 feet.</p>',
      } }],
    });

    const feature = character.features.flatMap((group) => group.items)
      .find((item) => item.name === 'Patient Guardian');
    expect(JSON.stringify(feature)).toContain('regain 2d6 hit points');
    expect(JSON.stringify(feature)).toContain('30 feet');
  });

  it('preserves every result of a roll table in a printable rules table', () => {
    const rows = Array.from({ length: 20 }, (_, index) => [
      String(index + 1),
      `Result ${index + 1}: recover ${index + 1} hit points.`,
    ]);
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: {
        id: 102,
        name: 'Fortune Wheel',
        description: '<p>Roll a d20 to determine the result.</p>' +
          '<table><thead><tr><th>d20</th><th>Effect</th></tr></thead><tbody>' +
          rows.map(([roll, effect]) => `<tr><td>${roll}</td><td>${effect}</td></tr>`).join('') +
          '</tbody></table>',
      } }],
    });

    expect(character).toMatchObject({
      ruleTables: expect.arrayContaining([
        expect.objectContaining({ columns: ['d20', 'Effect'], rows }),
      ]),
    });
    expect(character.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'tables', isEmpty: false }),
    ]));
  });

  it('extracts usable companion statistics rather than truncating them into a feature blurb', () => {
    const character = normalizeCharacter({
      ...base,
      feats: [{ definition: {
        id: 103,
        name: 'Construct Bond',
        description: '<p>Your bond grants the following companion.</p>' +
          '<div class="stat-block">' +
          '<h3 class="Stat-Block-Title">Workshop Helper</h3>' +
          '<p><em>Small Construct</em></p>' +
          '<p><strong>Armor Class</strong> 15</p>' +
          '<p><strong>Hit Points</strong> 25</p>' +
          '<p><strong>Speed</strong> 30 ft.</p>' +
          '<p><strong>Actions</strong></p>' +
          '<p><strong>Repair.</strong> Restore 1d6 hit points to a nearby construct.</p>' +
          '</div>',
      } }],
    });

    expect(character).toMatchObject({
      companions: expect.arrayContaining([
        expect.objectContaining({
          name: 'Workshop Helper',
          source: 'Construct Bond',
          armorClass: '15',
          hitPoints: '25',
          speed: '30 ft.',
        }),
      ]),
    });
    expect(character.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'companions', isEmpty: false }),
    ]));
  });
});
