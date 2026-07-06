import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionsCard from '@/components/ActionsCard.vue';

describe('ActionsCard', () => {
  it('lists action names', () => {
    const wrapper = mount(ActionsCard, {
      props: { actions: [{ name: 'Channel Divinity' }, { name: 'Dagger' }] },
    });

    expect(wrapper.findAll('[data-action]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Channel Divinity');
    expect(wrapper.text()).toContain('Dagger');
  });
});
