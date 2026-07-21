import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ProficienciesCard from '@/components/cards/ProficienciesCard.vue';
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

  it('splits the groups into the requested number of columns', () => {
    const wrapper = mount(ProficienciesCard, { props: { proficiencies, columns: 2 } });

    expect(wrapper.findAll('.profs__column')).toHaveLength(2);
    // The three non-empty groups still all render.
    expect(wrapper.findAll('[data-group]')).toHaveLength(3);
  });

  it('stacks items under a heading in the multi-column layout', () => {
    const wrapper = mount(ProficienciesCard, { props: { proficiencies, columns: 2 } });

    const languages = wrapper.get('[data-group="Languages"]');
    expect(languages.get('.profs__heading').text()).toBe('Languages');
    // Common + Elvish become one list item each (not comma-joined).
    const items = languages.findAll('.profs__item');
    expect(items.map((item) => item.text())).toEqual(['Common', 'Elvish']);
  });

  it('promotes a two-wide layout to three columns when two overflow', async () => {
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('profs') ? 100 : 0;
      });
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (!this.classList.contains('profs__column')) return 0;
        return this.closest('.profs')?.querySelectorAll('.profs__column').length === 2
          ? 130
          : 90;
      });

    const wrapper = mount(ProficienciesCard, {
      props: {
        columns: 2,
        proficiencies: {
          languages: ['Common', 'Elvish'],
          weapons: ['Simple Weapons', 'Martial Weapons'],
          armor: ['Light Armor', 'Medium Armor'],
          tools: ['Thieves’ Tools', 'Herbalism Kit'],
        },
      },
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.findAll('.profs__column')).toHaveLength(3);
    expect(wrapper.classes()).toContain('profs--dense');
    expect(
      wrapper.findAll('.profs__column').map((column) =>
        column.findAll('[data-group]').map((group) => group.attributes('data-group')),
      ),
    ).toContainEqual(['Tools']);

    clientHeight.mockRestore();
    scrollHeight.mockRestore();
  });

  it('dedicates a column to the longest category for other characters', () => {
    const wrapper = mount(ProficienciesCard, {
      props: {
        columns: 3,
        proficiencies: {
          languages: ['Common'],
          weapons: ['Simple', 'Martial', 'Firearms', 'Longsword', 'Longbow'],
          armor: ['Light Armor'],
          tools: ['Thieves’ Tools'],
        },
      },
    });

    expect(
      wrapper.findAll('.profs__column').map((column) =>
        column.findAll('[data-group]').map((group) => group.attributes('data-group')),
      ),
    ).toContainEqual(['Weapons']);
  });

  it('uses compact three-column groups when stacked columns still overflow', async () => {
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('profs') ? 100 : 0;
      });
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (!this.classList.contains('profs__column')) return 0;
        const root = this.closest('.profs');
        if (root?.classList.contains('profs--compact')) return 90;
        return root?.querySelectorAll('.profs__column').length === 2 ? 130 : 115;
      });

    const wrapper = mount(ProficienciesCard, {
      props: {
        columns: 2,
        proficiencies: {
          languages: ['Common', 'Elvish', 'Dwarvish'],
          weapons: ['Simple', 'Martial', 'Firearms'],
          armor: ['Light', 'Medium', 'Heavy'],
          tools: ['Thieves’ Tools', 'Herbalism Kit', 'Navigator’s Tools'],
        },
      },
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.findAll('.profs__column')).toHaveLength(3);
    expect(wrapper.classes()).toContain('profs--compact');
    expect(wrapper.findAll('.profs__list')).toHaveLength(0);

    clientHeight.mockRestore();
    scrollHeight.mockRestore();
  });
});
