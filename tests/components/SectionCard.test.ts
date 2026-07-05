import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SectionCard from '@/components/SectionCard.vue';

describe('SectionCard', () => {
  it('renders the title and count with a size class', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        size: 'large',
      },
    });

    expect(wrapper.text()).toContain('Spells');
    expect(wrapper.text()).toContain('18');
    expect(wrapper.classes()).toContain('card--large');
    expect(wrapper.attributes('data-section-key')).toBe('spells');
  });

  it('shows an empty note when the section is empty', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 0, isEmpty: true },
        size: 'small',
      },
    });

    expect(wrapper.text()).toContain('Nothing here yet');
    expect(wrapper.classes()).toContain('card--small');
  });

  it('renders ability scores for the attributes section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'attributes',
          title: 'Attributes',
          count: 6,
          isEmpty: false,
        },
        size: 'medium',
        character: {
          id: 1,
          name: 'Test',
          classes: [],
          level: 1,
          abilities: [
            { key: 'str', name: 'Strength', score: 15, modifier: 2 },
            { key: 'dex', name: 'Dexterity', score: 10, modifier: 0 },
            { key: 'con', name: 'Constitution', score: 14, modifier: 2 },
            { key: 'int', name: 'Intelligence', score: 12, modifier: 1 },
            { key: 'wis', name: 'Wisdom', score: 18, modifier: 4 },
            { key: 'cha', name: 'Charisma', score: 8, modifier: -1 },
          ],
          basics: {
            armorClass: 20,
            initiative: 0,
            speed: 30,
            proficiencyBonus: 2,
            hitPoints: { current: 4, max: 31, temp: 0 },
            conditions: [],
          },
          sections: [],
        },
      },
    });

    expect(wrapper.find('[data-ability="wis"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('+4');
    expect(wrapper.text()).not.toContain('Details coming soon');
  });

  it('renders the basics stats for the basics section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'basics',
          title: 'Basics',
          count: 0,
          isEmpty: false,
        },
        size: 'large',
        character: {
          id: 1,
          name: 'Test',
          classes: [],
          level: 4,
          abilities: [],
          basics: {
            armorClass: 20,
            initiative: 0,
            speed: 30,
            proficiencyBonus: 2,
            hitPoints: { current: 4, max: 31, temp: 0 },
            conditions: [],
          },
          sections: [],
        },
      },
    });

    expect(wrapper.find('[data-stat="ac"]').text()).toContain('20');
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('4');
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('31');
    expect(
      wrapper.findAll('[data-stat="conditions"] input[type="checkbox"]'),
    ).toHaveLength(15);
    expect(wrapper.text()).not.toContain('Details coming soon');
  });
});
