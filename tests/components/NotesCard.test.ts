import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NotesCard from '@/components/NotesCard.vue';

describe('NotesCard', () => {
  it('renders note entries by label', () => {
    const wrapper = mount(NotesCard, {
      props: {
        notes: [{ label: 'Backstory', text: 'Born in shadow.' }],
      },
    });

    expect(wrapper.get('[data-note="Backstory"]').text()).toContain('Born in shadow.');
  });

  it('shows a placeholder when there are no notes', () => {
    const wrapper = mount(NotesCard, { props: { notes: [] } });
    expect(wrapper.text()).toContain('Space for your notes');
  });
});
