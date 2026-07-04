import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloWorld from './HelloWorld.vue';

// Phase 0 smoke test: proves the harness (Vitest + WxtVitest + happy-dom +
// Vue Test Utils) can mount and interact with a Vue component.
describe('HelloWorld', () => {
  it('renders the msg prop', () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'Hello WXT' } });
    expect(wrapper.get('h1').text()).toBe('Hello WXT');
  });

  it('increments the counter when the button is clicked', async () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'x' } });
    const button = wrapper.get('button');

    expect(button.text()).toContain('count is 0');
    await button.trigger('click');
    expect(button.text()).toContain('count is 1');
  });
});
