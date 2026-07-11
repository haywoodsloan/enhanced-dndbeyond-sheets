import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PortraitCard from '@/components/cards/PortraitCard.vue';

describe('PortraitCard', () => {
  it('renders the avatar image', () => {
    const wrapper = mount(PortraitCard, {
      props: { avatarUrl: 'https://example.com/noct.jpeg' },
    });

    const img = wrapper.get('img');
    expect(img.attributes('src')).toBe('https://example.com/noct.jpeg');
    expect(img.attributes('alt')).toBeTruthy();
  });
});
