import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SkillsCard from '@/components/cards/SkillsCard.vue';
import type { Skill } from '@/services/dndbeyond/model';

const skills: Skill[] = [
  { key: 'stealth', name: 'Stealth', ability: 'dex', modifier: 5, proficiency: 'expertise' },
  { key: 'arcana', name: 'Arcana', ability: 'int', modifier: 1, proficiency: 'none' },
];

describe('SkillsCard', () => {
  it('renders each skill with ability, modifier, and proficiency', () => {
    const wrapper = mount(SkillsCard, { props: { skills } });

    expect(wrapper.findAll('[data-skill]')).toHaveLength(2);

    const stealth = wrapper.get('[data-skill="stealth"]');
    expect(stealth.text()).toContain('Stealth');
    expect(stealth.text()).toContain('DEX');
    expect(stealth.text()).toContain('+5');
    expect(stealth.find('.skill__prof--expertise').exists()).toBe(true);

    const arcana = wrapper.get('[data-skill="arcana"]');
    expect(arcana.find('.skill__prof--none').exists()).toBe(true);
  });

  it('splits skills into the requested number of columns', () => {
    const many: Skill[] = Array.from({ length: 6 }, (_, index) => ({
      key: `skill-${index}`,
      name: `Skill ${index}`,
      ability: 'int',
      modifier: 0,
      proficiency: 'none',
    }));

    const twoCol = mount(SkillsCard, { props: { skills: many, columns: 2 } });
    expect(twoCol.findAll('.skills__column')).toHaveLength(2);
    expect(twoCol.findAll('[data-skill]')).toHaveLength(6);

    const oneCol = mount(SkillsCard, { props: { skills: many, columns: 1 } });
    expect(oneCol.findAll('.skills__column')).toHaveLength(1);
  });
});
