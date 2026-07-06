import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProficienciesCard from '@/components/ProficienciesCard.vue';
import type { CharacterProficiencies } from '@/services/dndbeyond/model';

const proficiencies: CharacterProficiencies = {
  languages: ['Common', 'Elvish'],
  weapons: ['Simple Weapons'],
  armor: ['Light Armor'],
  tools: [],
};

describe('ProficienciesCard', () => {
  it('renders non-empty groups only', () => {
    const wrapper = mount(ProficienciesCard, { props: { proficiencies } });

    expect(wrapper.get('[data-group="Languages"]').text()).toContain('Common');
    expect(wrapper.get('[data-group="Weapons"]').text()).toContain('Simple Weapons');
    expect(wrapper.find('[data-group="Tools"]').exists()).toBe(false);
  });
});
