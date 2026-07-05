import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SectionCard from '@/components/SectionCard.vue';

describe('SectionCard', () => {
  it('renders the title and count with a size class', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        size: 'large',
      },
    });

    expect(wrapper.text()).toContain('Spells');
    expect(wrapper.text()).toContain('18');
    expect(wrapper.classes()).toContain('card--large');
    expect(wrapper.attributes('data-section-key')).toBe('spells');
  });

  it('shows an empty note when the section is empty', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 0, isEmpty: true },
        size: 'small',
      },
    });

    expect(wrapper.text()).toContain('Nothing here yet');
    expect(wrapper.classes()).toContain('card--small');
  });
});
