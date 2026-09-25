import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import FeaturesCard from '@/components/cards/FeaturesCard.vue';
import ActionsCard from '@/components/cards/ActionsCard.vue';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import SpellCard from '@/components/cards/SpellCard.vue';
import SpellsCard from '@/components/cards/SpellsCard.vue';
import SectionCard from '@/components/SectionCard.vue';
import type { CompanionEntry, ResourceRecovery, SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { makeCharacter } from '../../fixtures/character';

const richSpell: SpellEntry = {
  name: 'Test Beacon',
  level: 2,
  ability: 'INT',
  material: 'A test crystal worth 10 GP, consumed.',
  summary: 'A **bright** beacon.',
  upcast: 'Add one test target per higher slot.',
  list: { label: 'Modes', items: [{ label: 'Signal', text: 'A **visible** signal.' }] },
  related: ['companions', 'tables'],
  uses: { max: 9, recharge: 'LR' },
  featureUses: [
    { source: 'Gift of Light', pool: { max: 1, recovery: { kind: 'rest', rest: 'long' } } },
    { source: 'Study of Light', pool: { max: 2, recovery: { kind: 'rest', rest: 'short' } } },
  ],
};

const casting: Spellcasting = {
  ability: 'WIS', modifier: 1, attack: 3, saveDc: 11, slots: [2],
  profiles: [
    { source: 'Scholar', ability: 'INT', modifier: 4, attack: 6, saveDc: 14, focus: 'Test orb' },
    { source: 'Pact', ability: 'CHA', modifier: 3, attack: 5, saveDc: 13 },
  ],
  pactSlots: [{ source: 'Pact', level: 3, max: 2 }],
};

const companion: CompanionEntry = {
  name: 'Clockwork Scout', source: 'Test Beacon', meta: 'Small construct',
  challengeRating: '1/4', armorClass: '14', hitPoints: '12 (3d6 + 2)', speed: '30 ft., fly 40 ft.',
  abilities: [{ key: 'str', score: '10', modifier: '+0', save: '+2' }],
  details: [
    { section: 'Traits', label: 'Watcher', text: 'The scout can **observe**.' },
    { section: 'Actions', label: 'Pulse', text: 'A test pulse.' },
  ],
};

describe('rich print presentation', () => {
  it.each<[ResourceRecovery, string]>([
    [{ kind: 'rest', rest: 'short' }, 'short rest'],
    [{ kind: 'rest', rest: 'long' }, 'Long rest'],
    [{ kind: 'partial-short-full-long', shortRestUses: 2 }, '2/short rest, all/long rest'],
  ])('prefers structured recovery over legacy recharge: %j', (recovery, label) => {
    const wrapper = mount(ResourceBoxes, {
      props: { resource: { max: 12, recovery, recharge: 'legacy placeholder' } },
    });
    expect(wrapper.get('.resource__recharge').text()).toBe(label);
    expect(wrapper.findAll('.resource__box')).toHaveLength(12);
    expect(wrapper.findAll('.resource__box').every((box) => box.text() === '')).toBe(true);
    expect(wrapper.text()).not.toContain('legacy placeholder');
  });

  it('prints every alternate recovery cost without consuming or filling boxes', () => {
    const wrapper = mount(ResourceBoxes, {
      props: {
        resource: {
          max: 3,
          alternateRecovery: [
            { restores: 1, cost: '1 Test Die' },
            { restores: 2, cost: '3 Test Points' },
            { restores: 'all', cost: '1 Test Charge' },
          ],
        },
      },
    });
    expect(wrapper.findAll('[data-alternate-recovery]').map((entry) => entry.text())).toEqual([
      'or spend 1 Test Die',
      'or spend 3 Test Points to restore 2',
      'or spend 1 Test Charge to restore all',
    ]);
    expect(wrapper.findAll('.resource__box')).toHaveLength(3);
  });

  for (const expanded of [false, true]) {
    it(`preserves every explicit casting source on the ${expanded ? 'expanded' : 'quick'} card`, () => {
      const spell: SpellEntry = {
        name: 'Hold Person', level: 2, ability: 'INT',
        castingSources: [
          { source: 'Wizard', ability: 'INT', modifier: 2, attack: 5, saveDc: 13 },
          { source: 'Cleric', ability: 'WIS', modifier: 4, attack: 7, saveDc: 15 },
          { source: 'Scholar Gift', ability: 'INT', modifier: 2, attack: 6, saveDc: 14, focus: 'A test token.' },
        ],
      };
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell, spellcasting: casting } })
        : mount(SpellsCard, { props: { spells: [spell], spellcasting: casting } });
      const context = wrapper.get('[data-spell-casting]');
      for (const text of ['Wizard (INT)', 'Save DC 13', 'Cleric (WIS)', 'Save DC 15', 'Scholar Gift (INT)', 'A test token.']) {
        expect(context.text()).toContain(text);
      }
      expect(context.text()).not.toContain('Pact');
    });

    it(`shows a sole explicit casting source without aggregate metadata on the ${expanded ? 'expanded' : 'quick'} card`, () => {
      const spell: SpellEntry = {
        name: 'Ward', level: 1,
        castingSources: [{ source: 'Gift', ability: 'WIS', modifier: 4, attack: 7, saveDc: 15 }],
      };
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell } })
        : mount(SpellsCard, { props: { spells: [spell] } });
      expect(wrapper.get('[data-spell-casting]').text()).toContain('Gift (WIS)');
    });

    it(`shows independent grant pools and complete spell detail on the ${expanded ? 'expanded' : 'quick'} card`, () => {
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell: richSpell, companionTitle: 'Summons' } })
        : mount(SpellsCard, { props: { spells: [richSpell], companionTitle: 'Summons' } });
      expect(wrapper.findAll('[data-spell-uses] .resource__box')).toHaveLength(3);
      expect(wrapper.text()).toContain('Gift of Light');
      expect(wrapper.text()).toContain('Study of Light');
      expect(wrapper.text()).toContain('A test crystal worth 10 GP, consumed.');
      expect(wrapper.text()).toContain('Add one test target per higher slot.');
      expect(wrapper.text()).toContain('INT');
      expect(wrapper.text()).toContain('(see Summons)');
      expect(wrapper.text()).toContain('(see Tables)');
      expect(wrapper.get('[data-structured-list]').text()).toContain('Signal');
      expect(wrapper.get('[data-structured-list-item] > strong').text()).toBe('Signal');
      expect(wrapper.get('[data-structured-list-item] .rich-text strong').text()).toBe('visible');
      expect(wrapper.find('script').exists()).toBe(false);
    });

    it(`retains legacy uses when the ${expanded ? 'expanded' : 'quick'} card has no independent grants`, () => {
      const spell: SpellEntry = { name: 'Legacy', level: 1, featureUses: [], uses: { max: 2 } };
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell } })
        : mount(SpellsCard, { props: { spells: [spell] } });
      expect(wrapper.findAll('[data-spell-uses] .resource__box')).toHaveLength(2);
    });

    it(`identifies the applicable multiclass profile on the ${expanded ? 'expanded' : 'quick'} card`, () => {
      const spell: SpellEntry = { name: 'Test Beacon', level: 2, ability: 'CHA', save: 'DEX' };
      const key = expanded ? 'spell:test-beacon' : 'spells';
      const wrapper = mount(SectionCard, {
        props: {
          section: { key, title: 'Spells', count: 1, isEmpty: false },
          span: { cols: 3, rows: 2 },
          character: makeCharacter({ spells: [spell], spellcasting: casting }),
        },
      });
      const context = wrapper.get('[data-spell-casting]');
      expect(context.text()).toContain('Pact (CHA)');
      expect(context.text()).toContain('Spell attack +5');
      expect(context.text()).toContain('Save DC 13');
      expect(context.text()).not.toContain('Scholar');
      expect(context.text()).not.toContain('DC 11');
    });

    it(`keeps same-ability profiles distinguishable on the ${expanded ? 'expanded' : 'quick'} card`, () => {
      const spell: SpellEntry = { name: 'Test Beacon', level: 2, ability: 'INT' };
      const sameAbility: Spellcasting = {
        ...casting,
        profiles: [
          { source: 'Scholar', ability: 'INT', modifier: 4, attack: 6, saveDc: 14 },
          { source: 'Gift', ability: 'INT', modifier: 4, attack: 7, saveDc: 15 },
        ],
      };
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell, spellcasting: sameAbility } })
        : mount(SpellsCard, { props: { spells: [spell], spellcasting: sameAbility } });
      const context = wrapper.get('[data-spell-casting]');
      expect(context.text()).toContain('By casting source');
      expect(context.text()).toContain('Scholar (INT)');
      expect(context.text()).toContain('DC 14');
      expect(context.text()).toContain('Gift (INT)');
      expect(context.text()).toContain('DC 15');
      expect(context.text()).not.toContain('DC 11');
    });

    it.each([undefined, 'WIS'])(`does not guess a profile for %s on the ${expanded ? 'expanded' : 'quick'} card`, (ability) => {
      const spell: SpellEntry = { name: 'Test Beacon', level: 2, ability };
      const wrapper = expanded
        ? mount(SpellCard, { props: { spell, spellcasting: casting } })
        : mount(SpellsCard, { props: { spells: [spell], spellcasting: casting } });
      const context = wrapper.get('[data-spell-casting]');
      expect(context.text()).toContain(ability ? 'WIS: source-specific casting' : 'Casting source not specified');
      expect(context.text()).not.toMatch(/\bDC \d/);
    });
  }

  it('shows every casting profile and keeps pact slots distinct at their own empty level', () => {
    const wrapper = mount(SpellsCard, { props: { spells: [], spellcasting: casting } });
    const profiles = wrapper.findAll('[data-spellcasting-profile]');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].text()).toContain('Scholar');
    expect(profiles[0].text()).toContain('+6');
    expect(profiles[0].text()).toContain('DC 14');
    expect(profiles[0].text()).toContain('Test orb');
    expect(profiles[1].text()).toContain('CHA');
    expect(wrapper.get('[data-level="1"] [data-slots]').findAll('.resource__box')).toHaveLength(2);
    const pact = wrapper.get('[data-level="3"] [data-pact-slots]');
    expect(pact.findAll('.resource__box')).toHaveLength(2);
    expect(pact.text()).toContain('Pact');
    expect(pact.text()).toContain('short rest');
    expect(wrapper.findAll('[data-spell-level]')).toHaveLength(2);
  });

  it('renders a summary-only aggregate without duplicating spells or cantrip-only groups', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [richSpell, { name: 'Test Cantrip', level: 0 }],
        spellcasting: casting, summaryOnly: true,
      },
    });
    expect(wrapper.findAll('[data-spellcasting-profile]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Test orb');
    expect(wrapper.find('[data-spell]').exists()).toBe(false);
    expect(wrapper.find('[data-level="0"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-slots] .resource__box')).toHaveLength(2);
    expect(wrapper.findAll('[data-pact-slots] .resource__box')).toHaveLength(2);
  });

  it('enriches features without replacing the row-aligned layout or flattening lists and tables', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        rowAligned: true, companionTitle: 'Wild Forms',
        features: [{
          label: 'Test Features',
          items: [{
            name: 'Test Training', reference: 'actions', related: ['companions'],
            grantedSpells: ['Test Beacon'],
            grants: [{ label: 'Languages', items: ['Test Language'] }],
            list: { items: [{ text: 'Top-level option' }] },
            table: { columns: ['Top key', 'Top value'], rows: [['A', 'B']] },
            parts: [{
              label: 'Options', text: 'Choose **one**.',
              reference: 'tables', grantedSpells: ['Test Spark'],
              list: { items: [{ label: 'Bright', text: '<script>untrusted</script>' }] },
              table: { columns: ['Roll', 'Result'], rows: [['1', 'Bright'], ['2', 'Dim']] },
            }],
          }],
        }],
      },
    });
    expect(wrapper.get('.features__list').classes()).toContain('features__list--row-aligned');
    expect(wrapper.text()).toContain('(see Actions)');
    expect(wrapper.text()).toContain('(see Wild Forms)');
    expect(wrapper.text()).toContain('(see Tables)');
    expect(wrapper.get('[data-feature-grant]').text()).toContain('Languages: Test Language');
    expect(wrapper.get('[data-feature-spells]').text()).toContain('Test Beacon');
    expect(wrapper.get('[data-feature-part-spells]').text()).toContain('Test Spark');
    expect(wrapper.findAll('[data-structured-list]')).toHaveLength(2);
    expect(wrapper.findAll('[data-feature-table]')).toHaveLength(2);
    expect(wrapper.text()).toContain('<script>untrusted</script>');
    expect(wrapper.find('script').exists()).toBe(false);
  });

  it('shows action rolls, structured options, and source-specific references', () => {
    const wrapper = mount(ActionsCard, {
      props: {
        companionTitle: 'Wild Forms', rowAligned: true,
        actions: [{
          name: 'Test Action', category: 'bonus', roll: '1d6 healing',
          list: { items: [{ label: 'Mode', text: 'Test effect.' }] },
          related: ['companions', 'tables'],
        }],
      },
    });
    expect(wrapper.text()).toContain('1d6 healing');
    expect(wrapper.text()).toContain('Test effect.');
    expect(wrapper.text()).toContain('(see Wild Forms)');
    expect(wrapper.text()).toContain('(see Tables)');
    expect(wrapper.get('.actions__list').classes()).toContain('actions__list--row-aligned');
  });

  it('dispatches companion stat blocks with source labels and independent break parts', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'companions', title: 'Summons', count: 1, isEmpty: false },
        span: { cols: 1, rows: 2 },
        character: makeCharacter({ companions: [companion] }),
      },
    });
    const card = wrapper.get('[data-companion]');
    for (const text of ['Clockwork Scout', 'Test Beacon', 'Small construct', '1/4', '14', '12 (3d6 + 2)', 'Strength', '+0', '+2', 'Pulse']) {
      expect(card.text()).toContain(text);
    }
    expect(card.findAll('[data-companion-part]')).toHaveLength(3);
    expect(card.text()).not.toContain('**');
  });

  it.each(['companions', 'tables'] as const)('is empty-safe before %s extraction is wired', (key) => {
    const character = makeCharacter();
    delete character.companions;
    delete character.ruleTables;
    const wrapper = mount(SectionCard, {
      props: { section: { key, title: key, count: 0, isEmpty: true }, span: { cols: 3, rows: 2 }, character },
    });
    expect(wrapper.find('[data-companion]').exists()).toBe(false);
    expect(wrapper.find('[data-rule-table]').exists()).toBe(false);
  });

  it.each(['actions', 'features', 'spells', 'spell:test-beacon'] as const)(
    'propagates the real companion section title through %s',
    (key) => {
      const character = makeCharacter({
        sections: [{ key: 'companions', title: 'Wild Forms', count: 1, isEmpty: false }],
        actions: [{ name: 'Test Action', category: 'action', related: ['companions'] }],
        features: [{ label: 'Test', items: [{ name: 'Test Feature', related: ['companions'] }] }],
        spells: [richSpell],
      });
      const wrapper = mount(SectionCard, {
        props: { section: { key, title: key, count: 1, isEmpty: false }, span: { cols: 3, rows: 2 }, character },
      });
      expect(wrapper.text()).toContain('(see Wild Forms)');
      expect(wrapper.text()).not.toContain('(see Companions)');
    },
  );

  it.each(['companions', 'tables'] as const)('measures safe %s row boundaries for continuation cards', async (key) => {
    const selector = key === 'companions' ? '[data-companion-part]' : '[data-rule-row]';
    const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('card__body')) return new DOMRect(0, 0, 300, 300);
        if (this.matches(selector)) {
          const parts = Array.from(this.closest('.card__body')!.querySelectorAll(selector));
          return new DOMRect(0, parts.indexOf(this) * 100, 300, 100);
        }
        return new DOMRect(0, 0, 300, 0);
      });
    const wrapper = mount(SectionCard, {
      props: {
        section: { key, title: key, count: 1, isEmpty: false }, span: { cols: 3, rows: 2 },
        character: makeCharacter({
          companions: [companion],
          ruleTables: [{ title: 'Test Outcomes', source: 'Test Feature', columns: ['Roll', 'Result'], rows: [['1', 'Bright'], ['2', 'Dim']] }],
        }),
      },
    });
    try {
      await flushPromises();
      const measurement = wrapper.emitted('measure')?.at(-1)?.[1] as { breaks: number[] };
      expect(measurement.breaks).toEqual([100, 200, 300]);
      if (key === 'tables') {
        expect(wrapper.get('[data-rule-table]').text()).toContain('Test Outcomes');
        expect(wrapper.get('[data-rule-table]').text()).toContain('Test Feature');
        expect(wrapper.get('[data-rule-table]').text()).toContain('Dim');
      }
    } finally {
      wrapper.unmount();
      geometry.mockRestore();
    }
  });
});
