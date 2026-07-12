import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from '@/entrypoints/sheet/App.vue';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import type { Character } from '@/services/dndbeyond/model';
import { pageFormatPref, pageOrientationPref, sectionAnchorsPref } from '@/utils/settings/preferences';
import { DEFAULT_FORMAT_ID, DEFAULT_ORIENTATION_ID } from '@/utils/layout/page-format';
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
    { key: 'senses', title: 'Senses', count: 4, isEmpty: false },
    { key: 'proficiencies', title: 'Proficiencies', count: 12, isEmpty: false },
    { key: 'actions', title: 'Actions', count: 3, isEmpty: false },
    { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
    { key: 'inventory', title: 'Inventory', count: 24, isEmpty: false },
    { key: 'wealth', title: 'Wealth', count: 0, isEmpty: false },
    { key: 'features', title: 'Features & Traits', count: 39, isEmpty: false },
    { key: 'notes', title: 'Notes', count: 1, isEmpty: false },
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
    expect(items).toHaveLength(13);
    expect(items.map((item) => item.attributes('data-section-key'))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'wealth',
      'spells',
      'actions',
      'features',
      'inventory',
      'notes',
    ]);
    const attributesCard = wrapper.get('[data-section-key="attributes"]');
    expect(attributesCard.text()).toContain('Attributes');
    expect(attributesCard.text()).toContain('Strength');
  });

  it('shows an error message when loading fails', async () => {
    mockedLoad.mockRejectedValue(new Error('boom'));
    const wrapper = mount(App, { props: { characterId: 5 } });
    await flushPromises();

    expect(wrapper.text()).toContain('Could not load character');
    expect(wrapper.text()).toContain('boom');
  });

  it('prints the sheet from the Print button', () => {
    const printMock = vi.fn();
    vi.stubGlobal('print', printMock); // happy-dom has no window.print
    const wrapper = mount(App, { props: { characterId: null } });
    wrapper.get('.settings__button--print').trigger('click');
    expect(printMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('hides a section into the tray, then Reset restores it', async () => {
    mockedLoad.mockResolvedValue(sampleCharacter);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    await flushPromises();

    await wrapper.get('[data-section-key="notes"] .card__toggle').trigger('click');
    await flushPromises();
    expect(wrapper.find('.hidden-tray [data-section-key="notes"]').exists()).toBe(true);

    await wrapper.get('.settings__button--reset').trigger('click');
    await flushPromises();
    expect(wrapper.find('.hidden-tray').exists()).toBe(false);
  });

  it('cycles a card layout from its button, keeping its top-left cell', async () => {
    mockedLoad.mockResolvedValue(sampleCharacter);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    await flushPromises();

    // The card's grid placement is `<colLine> / span <w>` and `<rowLine> / span
    // <h>`; the two start lines are its top-left cell.
    const topLeftCell = () => {
      const style = wrapper.get('[data-section-key="inventory"]').attributes('style') ?? '';
      const col = /grid-column:\s*(\d+)/.exec(style)?.[1];
      const row = /grid-row:\s*(\d+)/.exec(style)?.[1];
      return `${col},${row}`;
    };
    const layout = () => wrapper.get('[data-section-key="inventory"] .card__layout');

    const labelBefore = layout().attributes('aria-label');
    const cellBefore = topLeftCell();
    await layout().trigger('click');
    await flushPromises();

    // The layout changed...
    expect(layout().attributes('aria-label')).not.toBe(labelBefore);
    // ...but the card stayed pinned at its top-left cell rather than reflowing.
    expect(topLeftCell()).toBe(cellBefore);
  });

  it('disables the layout toggle when no other layout fits the page', async () => {
    // 40 actions at Letter's 4 rows/page: only the Wide layout fits (Medium and
    // List would overflow), so the actions toggle has nothing viable to switch to
    // and is disabled. Inventory (24 items) still fits every layout, so its
    // toggle stays enabled.
    const heavy = {
      ...sampleCharacter,
      sections: sampleCharacter.sections.map((section) =>
        section.key === 'actions' ? { ...section, count: 40 } : section,
      ),
    };
    mockedLoad.mockResolvedValue(heavy);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    await flushPromises();

    const actionsToggle = wrapper.get('[data-section-key="actions"] .card__layout')
      .element as HTMLButtonElement;
    const inventoryToggle = wrapper.get('[data-section-key="inventory"] .card__layout')
      .element as HTMLButtonElement;
    expect(actionsToggle.disabled).toBe(true);
    expect(inventoryToggle.disabled).toBe(false);
  });

  it('shrinks a content-fit card to its measured content height', async () => {
    // Feed geometry so every card's end sentinel sits just 40px below its top:
    // the content-fit cards (actions/spells/features/notes) then report a short
    // height and shrink to a single row instead of their multi-row estimate.
    const gbcr = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const top = this.classList?.contains('card__end') ? 40 : 0;
        return {
          top,
          bottom: top,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      });
    class FakeResizeObserver {
      constructor(_callback: () => void) {}
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    mockedLoad.mockResolvedValue(sampleCharacter);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    await flushPromises();
    await nextTick();
    await flushPromises();

    // Actions (a content-fit card, estimate 2 rows) shrinks to a single row.
    const actionsStyle = wrapper.get('[data-section-key="actions"]').attributes('style') ?? '';
    expect(actionsStyle).toMatch(/grid-row:\s*\d+\s*\/\s*span 1/);
    // Notes is a blank write-in area — NOT content-fit — so it keeps its
    // multi-row estimate even though its (empty) content measures short.
    const notesStyle = wrapper.get('[data-section-key="notes"]').attributes('style') ?? '';
    expect(notesStyle).toMatch(/grid-row:\s*\d+\s*\/\s*span 2/);

    wrapper.unmount();
    gbcr.mockRestore();
    vi.unstubAllGlobals();
  });

  it('applies a stored non-default page format to the sheet', async () => {
    await pageFormatPref.set('a4');
    try {
      mockedLoad.mockResolvedValue(sampleCharacter);
      const wrapper = mount(App, { props: { characterId: 166869100 } });
      await flushPromises();
      // A4 is 210 × 297 mm; the sheet's CSS vars drive both the paper and @page size.
      const style = wrapper.get('.sheet').attributes('style') ?? '';
      expect(style).toMatch(/--page-width:\s*210mm/);
      expect(style).toMatch(/--page-height:\s*297mm/);
    } finally {
      await pageFormatPref.set(DEFAULT_FORMAT_ID);
    }
  });

  it('swaps the sheet dimensions when landscape orientation is chosen', async () => {
    await pageOrientationPref.set('landscape');
    try {
      mockedLoad.mockResolvedValue(sampleCharacter);
      const wrapper = mount(App, { props: { characterId: 166869100 } });
      await flushPromises();
      // Default Letter is 215.9 × 279.4 mm portrait; landscape swaps them.
      const style = wrapper.get('.sheet').attributes('style') ?? '';
      expect(style).toMatch(/--page-width:\s*279\.4mm/);
      expect(style).toMatch(/--page-height:\s*215\.9mm/);
    } finally {
      await pageOrientationPref.set(DEFAULT_ORIENTATION_ID);
    }
  });

  it('compacts scattered cards into fewer pages from the Compact button', async () => {
    // Seed a stray placement far down the sheet so a card sits alone on a late
    // page with empty space before it.
    await sectionAnchorsPref.set({ notes: { page: 6, col: 0, row: 0, seq: 1 } });
    mockedLoad.mockResolvedValue(sampleCharacter);
    const wrapper = mount(App, { props: { characterId: 166869100 } });
    try {
      await flushPromises();
      const pageCount = () => wrapper.findAll('.page').length;
      const before = pageCount();
      expect(before).toBeGreaterThan(1);

      await wrapper.get('.settings__button--compact').trigger('click');
      await flushPromises();

      // Cards slid up and left into the gaps, dropping the extra page.
      expect(pageCount()).toBeLessThan(before);
    } finally {
      wrapper.unmount(); // flush the debounced anchor save before resetting
      await sectionAnchorsPref.set({});
    }
  });
});
