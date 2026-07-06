import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import WealthCard from '@/components/WealthCard.vue';

describe('WealthCard', () => {
  it('renders each coin denomination', () => {
    const wrapper = mount(WealthCard, {
      props: { wealth: { cp: 0, sp: 0, ep: 0, gp: 224, pp: 2 } },
    });

    const gp = wrapper.get('[data-coin="gp"]');
    expect(gp.text()).toContain('224');
    expect(gp.text()).toContain('GP');
    expect(wrapper.get('[data-coin="pp"]').text()).toContain('2');
  });
});
