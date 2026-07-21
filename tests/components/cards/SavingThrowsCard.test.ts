import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SavingThrowsCard from '@/components/cards/SavingThrowsCard.vue';
import type { SavingThrow } from '@/services/dndbeyond/model';

const saves: SavingThrow[] = [
  { key: 'str', name: 'Strength', modifier: 2, proficient: false },
  { key: 'dex', name: 'Dexterity', modifier: 0, proficient: false },
  { key: 'con', name: 'Constitution', modifier: 2, proficient: false },
  { key: 'int', name: 'Intelligence', modifier: 1, proficient: false },
  { key: 'wis', name: 'Wisdom', modifier: 6, proficient: true },
  { key: 'cha', name: 'Charisma', modifier: 1, proficient: true },
];

describe('SavingThrowsCard', () => {
  it('renders each save with its modifier and proficiency marker', () => {
    const wrapper = mount(SavingThrowsCard, { props: { saves } });

    const rows = wrapper.findAll('[data-save]');
    expect(rows).toHaveLength(6);

    const wis = wrapper.get('[data-save="wis"]');
    expect(wis.text()).toContain('WIS');
    expect(wis.text()).toContain('+6');
    expect(wis.find('.save__prof--on').exists()).toBe(true);

    const str = wrapper.get('[data-save="str"]');
    expect(str.text()).toContain('+2');
    expect(str.find('.save__prof--on').exists()).toBe(false);
  });

  it('renders the defences list when provided', () => {
    const wrapper = mount(SavingThrowsCard, {
      props: {
        saves,
        defences: [
          { text: 'Intelligence saves', qualifier: 'Advantage' },
          { text: 'against being charmed', qualifier: 'Advantage' },
          { text: 'Magic sleep immunity' },
        ],
      },
    });
    const block = wrapper.get('[data-defences]');
    expect(block.text()).toContain('against being charmed');
    // The type renders as a leading "(…)" qualifier before the restriction.
    expect(block.find('.defences__qualifier').text()).toBe('(Advantage)');
    expect(wrapper.findAll('.defences__item')[0].text()).toContain(
      '(Advantage)Intelligence saves',
    );
    expect(wrapper.findAll('.defences__item')).toHaveLength(3);
  });

  it('omits the defences block when there are none', () => {
    const wrapper = mount(SavingThrowsCard, { props: { saves } });
    expect(wrapper.find('[data-defences]').exists()).toBe(false);
  });
});
