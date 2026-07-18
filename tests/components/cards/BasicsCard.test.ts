import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BasicsCard from '@/components/cards/BasicsCard.vue';
import type { CharacterBasics } from '@/services/dndbeyond/model';

const basics: CharacterBasics = {
  armorClass: 20,
  initiative: 0,
  speed: 30,
  proficiencyBonus: 2,
  hitPoints: { current: 4, max: 31, temp: 0 },
  hitDice: [{ die: 8, count: 4 }],
  inspiration: false,
  conditions: [],
};

describe('BasicsCard', () => {
  it('renders the core combat stats', () => {
    const wrapper = mount(BasicsCard, { props: { basics } });

    expect(wrapper.find('[data-stat="ac"]').text()).toContain('20');
    // Current HP is a writable blank; only the max is printed.
    expect(wrapper.find('[data-stat="hp"] .basics__blank').exists()).toBe(true);
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('31');
    expect(wrapper.find('[data-stat="initiative"]').text()).toContain('+0');
    expect(wrapper.find('[data-stat="speed"]').text()).toContain('30');
    expect(wrapper.find('[data-stat="proficiency"]').text()).toContain('+2');

    const boxes = wrapper.findAll(
      '[data-stat="conditions"] input[type="checkbox"]',
    );
    expect(boxes).toHaveLength(15);
    expect(
      boxes.every((box) => !(box.element as HTMLInputElement).checked),
    ).toBe(true);
    expect(wrapper.find('[data-stat="conditions"]').text()).toContain('Blinded');
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

    // Temp HP is a hand write-in line labelled "TEMP".
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('TEMP');
    expect(
      wrapper.find('[data-stat="hp"] .basics__temp-blank').exists(),
    ).toBe(true);
    const rows = wrapper.findAll('[data-stat="conditions"] .conditions__box');
    const poisoned = rows.find((row) => row.text().includes('Poisoned'));
    const blinded = rows.find((row) => row.text().includes('Blinded'));
    expect((poisoned!.find('input').element as HTMLInputElement).checked).toBe(
      true,
    );
    expect((blinded!.find('input').element as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('renders empty death save tracks', () => {
    const wrapper = mount(BasicsCard, { props: { basics } });

    const track = wrapper.find('[data-stat="death-saves"]');
    expect(track.exists()).toBe(true);
    expect(track.text()).toContain('Successes');
    expect(track.text()).toContain('Failures');

    const boxes = wrapper.findAll(
      '[data-stat="death-saves"] input[type="checkbox"]',
    );
    expect(boxes).toHaveLength(6);
    expect(
      boxes.every((box) => !(box.element as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('renders hit dice and an inspiration toggle', () => {
    const wrapper = mount(BasicsCard, {
      props: {
        basics: {
          ...basics,
          hitDice: [
            { die: 10, count: 2 },
            { die: 8, count: 3 },
          ],
          inspiration: true,
        },
      },
    });

    const dice = wrapper.find('[data-stat="hit-dice"]');
    expect(dice.text()).toContain('d10');
    expect(dice.text()).toContain('d8');
    // A remaining/total write-in per die size (no per-level boxes).
    expect(dice.findAll('.hitdice__blank')).toHaveLength(2);
    expect(dice.text()).toContain('/2');
    expect(dice.text()).toContain('/3');

    const inspiration = wrapper.find(
      '[data-stat="inspiration"] input[type="checkbox"]',
    );
    expect((inspiration.element as HTMLInputElement).checked).toBe(true);
  });
});
