import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '@/entrypoints/popup/App.vue';

describe('popup App', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prompts to open a character when the active tab is not a character page', async () => {
    vi.spyOn(browser.tabs, 'query').mockResolvedValue([
      { url: 'https://www.youtube.com/' },
    ] as never);
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);

    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.text()).toContain('Open a D&D Beyond character page');
    expect(wrapper.text()).toContain('select Beyond+ again');
    expect(create).not.toHaveBeenCalled();
  });

  it('opens the enhanced sheet when the active tab is a character page', async () => {
    vi.spyOn(browser.tabs, 'query').mockResolvedValue([
      { url: 'https://www.dndbeyond.com/characters/166869100' },
    ] as never);
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
    vi.spyOn(window, 'close').mockImplementation(() => {});

    const wrapper = mount(App);
    await flushPromises();

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { url: string };
    expect(arg.url).toContain('characterId=166869100');
    expect(wrapper.text()).not.toContain('Open a D&D Beyond character page');
  });
});
