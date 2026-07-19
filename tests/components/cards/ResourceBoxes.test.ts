import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

describe('ResourceBoxes', () => {
  it('renders one empty checkbox per use, with no tag when there is no recharge', () => {
    const wrapper = mount(ResourceBoxes, { props: { resource: { max: 3 } } });
    expect(wrapper.findAll('.resource__box')).toHaveLength(3);
    expect(wrapper.find('.resource__recharge').exists()).toBe(false);
  });

  it('spells out the recharge shorthand on the tag', () => {
    const sr = mount(ResourceBoxes, { props: { resource: { max: 1, recharge: 'SR' } } });
    expect(sr.find('.resource__recharge').text()).toBe('short rest');
    const lr = mount(ResourceBoxes, { props: { resource: { max: 1, recharge: 'LR' } } });
    expect(lr.find('.resource__recharge').text()).toBe('Long rest');
    // A split recharge (Channel Divinity): one use on a short rest, all on a long rest.
    const both = mount(ResourceBoxes, { props: { resource: { max: 2, recharge: 'SR1_LR' } } });
    expect(both.find('.resource__recharge').text()).toBe('1/short rest, all/long rest');
  });
});
