import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BasicsCard from '@/components/BasicsCard.vue';
import type { CharacterBasics } from '@/services/dndbeyond/model';

const basics: CharacterBasics = {
  armorClass: 20,
  initiative: 0,
  speed: 30,
  proficiencyBonus: 2,
  hitPoints: { current: 4, max: 31, temp: 0 },
  conditions: [],
};

describe('BasicsCard', () => {
  it('renders the core combat stats', () => {
    const wrapper = mount(BasicsCard, { props: { basics } });

    expect(wrapper.find('[data-stat="ac"]').text()).toContain('20');
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('4');
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('31');
    expect(wrapper.find('[data-stat="initiative"]').text()).toContain('+0');
    expect(wrapper.find('[data-stat="speed"]').text()).toContain('30');
    expect(wrapper.find('[data-stat="proficiency"]').text()).toContain('+2');
    expect(wrapper.find('[data-stat="conditions"]').text()).toContain('None');
  });

  it('shows temp HP and active conditions when present', () => {
    const wrapper = mount(BasicsCard, {
      props: {
        basics: {
          ...basics,
          hitPoints: { current: 12, max: 20, temp: 5 },
          conditions: ['Poisoned', 'Prone'],
        },
      },
    });

    expect(wrapper.find('[data-stat="hp"]').text()).toContain('temp');
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('5');
    const conditions = wrapper.find('[data-stat="conditions"]').text();
    expect(conditions).toContain('Poisoned');
    expect(conditions).toContain('Prone');
  });
});
