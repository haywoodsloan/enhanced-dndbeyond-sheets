import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SpellCard from '@/components/cards/SpellCard.vue';
import type { SpellEntry } from '@/services/dndbeyond/model';

const fireBolt: SpellEntry = {
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: 'A',
  range: '120 ft.',
  components: 'V, S',
  concentration: true,
  duration: '1 minute',
  material: 'a ruby worth 50 GP',
  related: ['companions'],
  summary: 'A concise spell effect.',
  attack: true,
  damage: {
    dice: '1d10',
    type: 'Fire',
    scaling: '+1d10 per slot level above 1st',
  },
};

describe('SpellCard', () => {
  it('renders the level, school symbol, and detail rows', () => {
    const wrapper = mount(SpellCard, { props: { spell: fireBolt } });
    expect(wrapper.get('.spell-card__level').text()).toBe('0');
    expect(wrapper.get('.spell-card__school').text()).toBe('Ev');
    const text = wrapper.text();
    expect(text).toContain('120 ft.');
    expect(text).toContain('V, S');
    expect(text).toContain('a ruby worth 50 GP');
    expect(text).toContain('Concentration, 1 minute');
    expect(text).toContain('1d10 Fire (+1d10 per slot level above 1st)');
    expect(text).toContain('Spell attack');
    expect(text).toContain('See Companions');
    expect(text).toContain('A concise spell effect.');
  });
});
