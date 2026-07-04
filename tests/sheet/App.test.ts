import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '@/entrypoints/sheet/App.vue';

describe('sheet App', () => {
  it('shows the character id when provided', () => {
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    expect(wrapper.text()).toContain('Character ID: 166869100');
  });

  it('shows a fallback message when no character id is provided', () => {
    const wrapper = mount(App, { props: { characterId: null } });
    expect(wrapper.text()).toContain('No character selected');
  });
});
