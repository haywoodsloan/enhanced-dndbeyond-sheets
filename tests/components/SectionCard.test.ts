import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SectionCard from '@/components/SectionCard.vue';
import { ToggleSpellCardsKey } from '@/utils/layout/spell-cards';
import { makeCharacter } from '../fixtures/character';

describe('SectionCard', () => {
  it('renders the title with a size class', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 3 },
      },
    });

    expect(wrapper.text()).toContain('Spells');
    expect(wrapper.attributes('style')).toContain('grid-column: span 3');
    expect(wrapper.attributes('data-section-key')).toBe('spells');
  });

  it('expands the Spells card and collapses a spell card via the injected toggle', async () => {
    const toggle = vi.fn();
    const character = makeCharacter({ spells: [{ name: 'Guidance', level: 0 }] });
    const provide = { [ToggleSpellCardsKey as symbol]: toggle };

    const spells = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 1, isEmpty: false },
        span: { cols: 3, rows: 2 },
        character,
      },
      global: { provide },
    });
    await spells.get('.card__spell-toggle').trigger('click');
    expect(toggle).toHaveBeenCalledTimes(1);

    const spellCard = mount(SectionCard, {
      props: {
        section: { key: 'spell:guidance', title: 'Guidance', count: 1, isEmpty: false },
        span: { cols: 1, rows: 2 },
        character,
      },
      global: { provide },
    });
    await spellCard.get('.card__spell-toggle').trigger('click');
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it('shows an empty note when the section is empty', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 0, isEmpty: true },
        span: { cols: 1, rows: 1 },
      },
    });

    expect(wrapper.text()).toContain('Nothing here yet');
    expect(wrapper.attributes('style')).toContain('grid-column: span 1');
  });

  it('renders ability scores for the attributes section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'attributes',
          title: 'Attributes',
          count: 6,
          isEmpty: false,
        },
        span: { cols: 2, rows: 2 },
        character: makeCharacter({
          abilities: [
            { key: 'str', name: 'Strength', score: 15, modifier: 2 },
            { key: 'dex', name: 'Dexterity', score: 10, modifier: 0 },
            { key: 'con', name: 'Constitution', score: 14, modifier: 2 },
            { key: 'int', name: 'Intelligence', score: 12, modifier: 1 },
            { key: 'wis', name: 'Wisdom', score: 18, modifier: 4 },
            { key: 'cha', name: 'Charisma', score: 8, modifier: -1 },
          ],
        }),
      },
    });

    expect(wrapper.find('[data-ability="wis"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('+4');
    expect(wrapper.text()).not.toContain('Details coming soon');
  });

  it('renders the basics stats for the basics section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'basics',
          title: 'Basics',
          count: 0,
          isEmpty: false,
        },
        span: { cols: 3, rows: 3 },
        character: makeCharacter({
          basics: {
            armorClass: 20,
            initiative: 0,
            speed: 30,
            proficiencyBonus: 2,
            hitPoints: { current: 4, max: 31, temp: 0 },
            hitDice: [],
            inspiration: false,
            conditions: [],
          },
        }),
      },
    });

    expect(wrapper.find('[data-stat="ac"]').text()).toContain('20');
    // Current HP is a writable blank; only the max is printed.
    expect(wrapper.find('[data-stat="hp"] .basics__blank').exists()).toBe(true);
    expect(wrapper.find('[data-stat="hp"]').text()).toContain('31');
    expect(
      wrapper.findAll('[data-stat="conditions"] input[type="checkbox"]'),
    ).toHaveLength(15);
    expect(wrapper.text()).not.toContain('Details coming soon');
  });

  it('renders saving throws for the savingThrows section', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: {
          key: 'savingThrows',
          title: 'Saves & Defences',
          count: 6,
          isEmpty: false,
        },
        span: { cols: 2, rows: 2 },
        character: makeCharacter({
          savingThrows: [
            { key: 'wis', name: 'Wisdom', modifier: 6, proficient: true },
          ],
        }),
      },
    });

    expect(wrapper.find('[data-save="wis"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('+6');
  });

  it('emits hide with the section key from the toggle button', async () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 2 },
      },
    });

    await wrapper.find('.card__toggle').trigger('click');

    expect(wrapper.emitted('hide')).toEqual([['spells']]);
    expect(wrapper.emitted('show')).toBeUndefined();
  });

  it('drops the fixed height and drag handle and emits show when hidden', async () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'spells', title: 'Spells', count: 18, isEmpty: false },
        span: { cols: 3, rows: 2 },
        hidden: true,
      },
    });

    expect(wrapper.attributes('style')).toContain('grid-column: span 3');
    expect(wrapper.attributes('style')).not.toContain('height');
    expect(wrapper.find('.card__drag-handle').exists()).toBe(false);

    await wrapper.find('.card__toggle').trigger('click');

    expect(wrapper.emitted('show')).toEqual([['spells']]);
    expect(wrapper.emitted('hide')).toBeUndefined();
  });

  it('emits cycleLayout from the layout button when a card has options', async () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'inventory', title: 'Inventory', count: 24, isEmpty: false },
        span: { cols: 3, rows: 2 },
        layoutCount: 3,
        layoutLabel: 'Wide',
      },
    });

    await wrapper.find('.card__layout').trigger('click');
    expect(wrapper.emitted('cycleLayout')).toEqual([['inventory']]);
  });

  it('hides the layout button when a card has a single layout', () => {
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'notes', title: 'Notes', count: 0, isEmpty: false },
        span: { cols: 3, rows: 2 },
        layoutCount: 1,
      },
    });

    expect(wrapper.find('.card__layout').exists()).toBe(false);
  });

  it('measures its content height and emits it for the sheet to shrink to fit', async () => {
    // happy-dom has no layout, so feed geometry: the card body reads 120px tall
    // (its natural content height) with its top flush to the card top.
    const gbcr = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const height = this.classList?.contains('card__body') ? 120 : 0;
        return {
          top: 0,
          bottom: height,
          left: 0,
          right: 0,
          width: 0,
          height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    class FakeResizeObserver {
      constructor(_callback: () => void) {}
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'actions', title: 'Actions', count: 8, isEmpty: false },
        span: { cols: 1, rows: 4 },
      },
    });
    await flushPromises();
    await nextTick();

    const measured = wrapper.emitted('measure');
    expect(measured).toBeTruthy();
    // Reports [key, { chrome, total, breaks }]: the body's natural height (120),
    // the title/padding chrome above it, and the item break offsets.
    const last = measured![measured!.length - 1];
    expect(last[0]).toBe('actions');
    const geometry = last[1] as { chrome: number; total: number; breaks: number[] };
    expect(geometry.total).toBeGreaterThanOrEqual(120);
    expect(geometry.chrome).toBe(0);
    expect(Array.isArray(geometry.breaks)).toBe(true);

    wrapper.unmount();
    gbcr.mockRestore();
    vi.unstubAllGlobals();
  });
});
