import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

describe('ResourceBoxes', () => {
  it('renders one empty checkbox per use, with no tag when there is no recharge', () => {
    const wrapper = mount(ResourceBoxes, { props: { resource: { max: 3 } } });
    expect(wrapper.findAll('.resource__box')).toHaveLength(3);
    expect(wrapper.find('.resource__recharge').exists()).toBe(false);
  });

  it('uses a compact write-in counter for a large point pool', () => {
    const wrapper = mount(ResourceBoxes, {
      props: { resource: { max: 20, recovery: { kind: 'rest', rest: 'long' } } },
    });
    expect(wrapper.findAll('.resource__box')).toHaveLength(0);
    const counter = wrapper.get('[data-resource-counter]');
    expect(counter.text()).toBe('/20');
    expect(counter.attributes('aria-label')).toBe('Uses remaining out of 20');
    expect(wrapper.find('.resource__recharge').text()).toBe('Long rest');
  });

  it('spells out structured recovery rules on the tag', () => {
    const sr = mount(ResourceBoxes, {
      props: { resource: { max: 1, recovery: { kind: 'rest', rest: 'short' } } },
    });
    expect(sr.find('.resource__recharge').text()).toBe('short rest');
    const lr = mount(ResourceBoxes, {
      props: { resource: { max: 1, recovery: { kind: 'rest', rest: 'long' } } },
    });
    expect(lr.find('.resource__recharge').text()).toBe('Long rest');
    // A split recharge (Channel Divinity): one use on a short rest, all on a long rest.
    const both = mount(ResourceBoxes, {
      props: {
        resource: {
          max: 2,
          recovery: { kind: 'partial-short-full-long', shortRestUses: 1 },
        },
      },
    });
    expect(both.find('.resource__recharge').text()).toBe('1/short rest, all/long rest');
  });

  it('shows other ways to restore uses by spending a resource', () => {
    const wrapper = mount(ResourceBoxes, {
      props: {
        resource: {
          max: 1,
          recovery: { kind: 'rest', rest: 'long' },
          alternateRecovery: [
            { restores: 1, cost: '1 Superiority Die' },
            { restores: 'all', cost: '1 Pact Magic slot' },
            { restores: 2, cost: '3 Focus Points' },
          ],
        },
      },
    });

    const alternatives = wrapper.findAll('[data-alternate-recovery]');
    expect(alternatives.map((entry) => entry.text())).toEqual([
      'or spend 1 Superiority Die',
      'or spend 1 Pact Magic slot to restore all',
      'or spend 3 Focus Points to restore 2',
    ]);
    expect(alternatives[0].attributes('title')).toBe('Restores 1 use');
    expect(alternatives[1].attributes('title')).toBe('Restores all uses');
    expect(alternatives[2].attributes('title')).toBe('Restores 2 uses');
  });
});
