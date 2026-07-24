import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CompanionsCard from '@/components/cards/CompanionsCard.vue';

const companion = {
  name: 'Steel Defender',
  source: 'Steel Defender',
  meta: 'Medium Construct, Neutral',
  challengeRating: '1',
  armorClass: '12 plus your Intelligence modifier',
  hitPoints: '5 plus five times your Artificer level',
  speed: '40 ft.',
  abilities: [
    { key: 'STR', score: '14', modifier: '+2', save: '+2' },
    { key: 'DEX', score: '12', modifier: '+1', save: '+1' },
  ],
  details: [
    { section: 'Statistics', label: 'Immunities', text: 'Poison; Charmed' },
    { section: 'Actions', label: 'Rend', text: 'Melee Attack Roll: your spell attack modifier.' },
  ],
};

describe('CompanionsCard', () => {
  it('renders a compact companion stat block with semantic break rows', () => {
    const wrapper = mount(CompanionsCard, { props: { companions: [companion] } });

    expect(wrapper.get('[data-companion]').text()).toContain('Steel Defender');
    expect(wrapper.find('.companion__source').exists()).toBe(false);
    expect(wrapper.find('.companion__source-sep').exists()).toBe(false);
    expect(wrapper.text()).toContain('Medium Construct, Neutral');
    expect(wrapper.text()).toContain('12 plus your Intelligence modifier');
    expect(wrapper.findAll('.companion__vitals dt').map((label) => label.text())).toEqual([
      'CR',
      'AC',
      'HP',
      'Speed',
    ]);
    expect(wrapper.findAll('.companion__ability')).toHaveLength(2);
    expect(wrapper.findAll('.companion__ability-key').map((label) => label.text())).toEqual([
      'Strength',
      'Dexterity',
    ]);
    expect(wrapper.get('.companion__abilities').attributes('style')).toContain(
      'grid-template-columns: repeat(3, minmax(140px, 160px))',
    );
    expect(wrapper.get('.companion__abilities').attributes('style')).toContain(
      'justify-content: center',
    );
    expect(wrapper.get('.companion__ability-mod').text()).toBe('+2');
    expect(wrapper.get('.companion__ability-save').text()).toBe('+2');
    expect(wrapper.findAll('.companion__ability-label').map((label) => label.text())).toEqual([
      'Mod',
      'Save',
      'Mod',
      'Save',
    ]);
    expect(wrapper.text()).toContain('Rend');
    expect(wrapper.findAll('[data-companion-part]')).toHaveLength(3);
    expect(wrapper.get('.companion__intro').find('.companion__header').exists()).toBe(true);
    expect(wrapper.get('.companion__intro').find('.companion__vitals').exists()).toBe(true);
    expect(wrapper.get('.companion__intro').find('.companion__abilities').exists()).toBe(true);
  });

  it('reflows ability rows to match the companion card width', () => {
    const medium = mount(CompanionsCard, {
      props: { companions: [companion], columns: 2 },
    });
    expect(medium.get('.companion__abilities').attributes('style')).toContain(
      'grid-template-columns: repeat(2, minmax(140px, 160px))',
    );

    const list = mount(CompanionsCard, {
      props: { companions: [companion], columns: 1 },
    });
    expect(list.get('.companion__abilities').attributes('style')).toContain(
      'grid-template-columns: repeat(1, minmax(140px, 160px))',
    );
  });

  it('uses full names for canonical abilities and preserves unknown keys', () => {
    const wrapper = mount(CompanionsCard, {
      props: {
        companions: [
          {
            ...companion,
            abilities: [
              { key: 'STR', score: '10' },
              { key: 'DEX', score: '10' },
              { key: 'CON', score: '10' },
              { key: 'INT', score: '10' },
              { key: 'WIS', score: '10' },
              { key: 'CHA', score: '10' },
              { key: 'Special', score: '10' },
            ],
          },
        ],
      },
    });

    expect(wrapper.findAll('.companion__ability-key').map((label) => label.text())).toEqual([
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
      'Special',
    ]);
  });

  it('renders sparse stat blocks without empty optional rows', () => {
    const wrapper = mount(CompanionsCard, {
      props: {
        companions: [
          {
            name: 'Homunculus Servant',
            source: 'Infuse Item',
            abilities: [{ key: 'INT', score: '10' }],
            details: [
              { section: 'Traits', label: '', text: 'It understands your languages.' },
              { section: 'Traits', label: '', text: 'It obeys your commands.' },
            ],
          },
        ],
      },
    });

    expect(wrapper.find('.companion__meta').exists()).toBe(false);
    expect(wrapper.get('.companion__source').text()).toBe('Infuse Item');
    expect(wrapper.find('.companion__vitals').exists()).toBe(false);
    expect(wrapper.find('.companion__ability-mod').exists()).toBe(false);
    expect(wrapper.find('.companion__ability-save').exists()).toBe(false);
    expect(wrapper.findAll('.companion__section')).toHaveLength(1);
    expect(wrapper.find('.companion__detail strong').exists()).toBe(false);
  });

  it('separates the companion name from its granting spell', () => {
    const wrapper = mount(CompanionsCard, {
      props: {
        companions: [
          {
            name: 'Bestial Spirit',
            source: 'Summon Beast',
            abilities: [],
            details: [],
          },
        ],
      },
    });

    const header = wrapper.get('.companion__header');
    expect(header.get('.companion__name').text()).toBe('Bestial Spirit');
    expect(header.get('.companion__source-sep').text()).toBe('|');
    expect(header.get('.companion__source').text()).toBe('Summon Beast');
    expect(header.text()).toBe('Bestial Spirit|Summon Beast');
  });
});
