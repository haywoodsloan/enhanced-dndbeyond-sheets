import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NotesCard from '@/components/cards/NotesCard.vue';

describe('NotesCard', () => {
  it('renders a blank write-in area with no preset content', () => {
    const wrapper = mount(NotesCard);
    expect(wrapper.find('.notes').exists()).toBe(true);
    expect(wrapper.findAll('[data-note]')).toHaveLength(0);
    expect(wrapper.text().trim()).toBe('');
  });
});
