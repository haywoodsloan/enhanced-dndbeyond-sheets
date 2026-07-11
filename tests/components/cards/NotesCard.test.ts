import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NotesCard from '@/components/cards/NotesCard.vue';

describe('NotesCard', () => {
  it('renders note entries by label', () => {
    const wrapper = mount(NotesCard, {
      props: {
        notes: [{ label: 'Backstory', text: 'Born in shadow.' }],
      },
    });

    expect(wrapper.get('[data-note="Backstory"]').text()).toContain('Born in shadow.');
  });

  it('renders nothing when there are no notes', () => {
    const wrapper = mount(NotesCard, { props: { notes: [] } });
    expect(wrapper.findAll('[data-note]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('Space for your notes');
  });
});
