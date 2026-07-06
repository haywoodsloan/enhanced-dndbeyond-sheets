import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from '@/entrypoints/sheet/App.vue';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import type { Character } from '@/services/dndbeyond/model';
import { makeCharacter } from '../fixtures/character';

vi.mock('@/services/dndbeyond/load-character', () => ({
  loadCharacter: vi.fn(),
}));

const mockedLoad = vi.mocked(loadCharacter);

const sampleCharacter = makeCharacter({
  id: 166869100,
  name: 'Noct',
  race: 'Elf',
  background: 'Spirit Medium',
  level: 4,
  classes: [{ name: 'Cleric', level: 4, subclass: 'Grave Domain' }],
  abilities: [
    { key: 'str', name: 'Strength', score: 15, modifier: 2 },
    { key: 'dex', name: 'Dexterity', score: 10, modifier: 0 },
    { key: 'con', name: 'Constitution', score: 14, modifier: 2 },
    { key: 'int', name: 'Intelligence', score: 12, modifier: 1 },
    { key: 'wis', name: 'Wisdom', score: 18, modifier: 4 },
    { key: 'cha', name: 'Charisma', score: 8, modifier: -1 },
  ],
  avatarUrl: 'https://example.com/avatar.jpeg',
  sections: [
    { key: 'portrait', title: 'Portrait', count: 0, isEmpty: false },
    { key: 'basics', title: 'Basics', count: 0, isEmpty: false },
    { key: 'attributes', title: 'Attributes', count: 6, isEmpty: false },
    { key: 'skills', title: 'Skills', count: 18, isEmpty: false },
    { key: 'savingThrows', title: 'Saves & Defences', count: 6, isEmpty: false },
    { key: 'proficiencies', title: 'Proficiencies', count: 12, isEmpty: false },
    { key: 'actions', title: 'Actions', count: 3, isEmpty: false },
    { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
    { key: 'inventory', title: 'Inventory', count: 24, isEmpty: false },
    { key: 'wealth', title: 'Wealth', count: 0, isEmpty: false },
    { key: 'features', title: 'Features & Traits', count: 39, isEmpty: false },
  ],
});

describe('sheet App', () => {
  beforeEach(() => {
    mockedLoad.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a fallback when no character id is provided', () => {
    const wrapper = mount(App, { props: { characterId: null } });
    expect(wrapper.text()).toContain('No character selected');
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('shows the page layout settings panel', () => {
    const wrapper = mount(App, { props: { characterId: null } });
    expect(wrapper.text()).toContain('Page layout');
    expect(wrapper.text()).toContain('Page type');
    expect(wrapper.text()).toContain('Margins');
    expect(wrapper.text()).toContain('Theme color');
  });

  it('shows a loading state while the character loads', () => {
    mockedLoad.mockReturnValue(new Promise<Character>(() => {}));
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    expect(wrapper.text()).toContain('Loading');
  });

  it('renders the name, subtitle, and section list once loaded', async () => {
    mockedLoad.mockResolvedValue(sampleCharacter);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    await flushPromises();

    expect(mockedLoad).toHaveBeenCalledWith(166869100);
    expect(wrapper.text()).toContain('Noct');
    expect(wrapper.text()).toContain('Cleric 4 (Grave Domain)');
    const items = wrapper.findAll('[data-section-key]');
    expect(items).toHaveLength(11);
    expect(items.map((item) => item.attributes('data-section-key'))).toEqual([
      'portrait',
      'basics',
      'attributes',
      'spells',
      'actions',
      'savingThrows',
      'skills',
      'features',
      'proficiencies',
      'inventory',
      'wealth',
    ]);
    const attributesCard = wrapper.get('[data-section-key="attributes"]');
    expect(attributesCard.text()).toContain('Attributes');
    expect(attributesCard.text()).toContain('6');
  });

  it('shows an error message when loading fails', async () => {
    mockedLoad.mockRejectedValue(new Error('boom'));
    const wrapper = mount(App, { props: { characterId: 5 } });
    await flushPromises();

    expect(wrapper.text()).toContain('Could not load character');
    expect(wrapper.text()).toContain('boom');
  });
});
