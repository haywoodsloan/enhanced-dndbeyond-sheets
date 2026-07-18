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
    expect(wrapper.find('[data-portrait-empty]').exists()).toBe(false);
  });

  it('shows a placeholder when there is no avatar url', () => {
    const wrapper = mount(PortraitCard, { props: { avatarUrl: '' } });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[data-portrait-empty]').exists()).toBe(true);
  });

  it('falls back to the placeholder if the image fails to load', async () => {
    const wrapper = mount(PortraitCard, {
      props: { avatarUrl: 'https://example.com/dead.png' },
    });

    expect(wrapper.find('img').exists()).toBe(true);
    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[data-portrait-empty]').exists()).toBe(true);
  });
});
