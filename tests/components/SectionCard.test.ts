import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SectionCard from '@/components/SectionCard.vue';
import { makeCharacter } from '../fixtures/character';

describe('SectionCard', () => {
  it('renders the title with a size class', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 3 },
      },
    });

    expect(wrapper.text()).toContain('Spells');
    expect(wrapper.attributes('style')).toContain('grid-column: span 3');
    expect(wrapper.attributes('data-section-key')).toBe('spells');
  });

  it('shows an empty note when the section is empty', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 0, isEmpty: true },
        span: { cols: 1, rows: 1 },
      },
    });

    expect(wrapper.text()).toContain('Nothing here yet');
    expect(wrapper.attributes('style')).toContain('grid-column: span 1');
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
        span: { cols: 2, rows: 2 },
        character: makeCharacter({
          abilities: [
            { key: 'str', name: 'Strength', score: 15, modifier: 2 },
            { key: 'dex', name: 'Dexterity', score: 10, modifier: 0 },
            { key: 'con', name: 'Constitution', score: 14, modifier: 2 },
            { key: 'int', name: 'Intelligence', score: 12, modifier: 1 },
            { key: 'wis', name: 'Wisdom', score: 18, modifier: 4 },
            { key: 'cha', name: 'Charisma', score: 8, modifier: -1 },
          ],
        }),
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
        span: { cols: 3, rows: 3 },
        character: makeCharacter({
          basics: {
            armorClass: 20,
            initiative: 0,
            speed: 30,
            proficiencyBonus: 2,
            hitPoints: { current: 4, max: 31, temp: 0 },
            conditions: [],
          },
        }),
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

  it('renders saving throws for the savingThrows section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'savingThrows',
          title: 'Saves & Defences',
          count: 6,
          isEmpty: false,
        },
        span: { cols: 2, rows: 2 },
        character: makeCharacter({
          savingThrows: [
            { key: 'wis', name: 'Wisdom', modifier: 6, proficient: true },
          ],
        }),
      },
    });

    expect(wrapper.find('[data-save="wis"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('+6');
  });

  it('emits hide with the section key from the toggle button', async () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 2 },
      },
    });

    await wrapper.find('.card__toggle').trigger('click');

    expect(wrapper.emitted('hide')).toEqual([['spells']]);
    expect(wrapper.emitted('show')).toBeUndefined();
  });

  it('drops the fixed height and drag handle and emits show when hidden', async () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 2 },
        hidden: true,
      },
    });

    expect(wrapper.attributes('style')).toContain('grid-column: span 3');
    expect(wrapper.attributes('style')).not.toContain('height');
    expect(wrapper.find('.card__drag-handle').exists()).toBe(false);

    await wrapper.find('.card__toggle').trigger('click');

    expect(wrapper.emitted('show')).toEqual([['spells']]);
    expect(wrapper.emitted('hide')).toBeUndefined();
  });
});
