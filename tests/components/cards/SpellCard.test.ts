import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SpellCard from '@/components/cards/SpellCard.vue';
import { ToggleSpellCardsKey } from '@/utils/layout/spell-cards';
import type { SpellEntry } from '@/services/dndbeyond/model';

const fireBolt: SpellEntry = {
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: 'A',
  range: '120 ft.',
  components: 'V, S',
  attack: true,
  damage: { dice: '1d10', type: 'Fire' },
};

describe('SpellCard', () => {
  it('renders the level, school symbol, and detail rows', () => {
    const wrapper = mount(SpellCard, { props: { spell: fireBolt } });
    expect(wrapper.get('.spell-card__level').text()).toBe('0');
    expect(wrapper.get('.spell-card__school').text()).toBe('Ev');
    const text = wrapper.text();
    expect(text).toContain('120 ft.');
    expect(text).toContain('V, S');
    expect(text).toContain('1d10 Fire');
    expect(text).toContain('Spell attack');
  });

  it('collapses back to the quick sheet via the injected toggle', async () => {
    const toggle = vi.fn();
    const wrapper = mount(SpellCard, {
      props: { spell: fireBolt },
      global: { provide: { [ToggleSpellCardsKey as symbol]: toggle } },
    });
    await wrapper.get('.spell-card__collapse').trigger('click');
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('hides the collapse button when no toggle is provided', () => {
    const wrapper = mount(SpellCard, { props: { spell: fireBolt } });
    expect(wrapper.find('.spell-card__collapse').exists()).toBe(false);
  });
});
