import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SectionCard from '@/components/SectionCard.vue';
import { ToggleSpellCardsKey } from '@/utils/layout/spell-cards';
import { continuationKey } from '@/utils/layout/card-continuation';
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
    const dragHandle = wrapper.get('.card__drag-handle');
    expect(dragHandle.element.tagName).toBe('BUTTON');
    expect(dragHandle.attributes('aria-label')).toBe('Move Spells card; use arrow keys');
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

  it('shows the spell legend on the base card and every continuation', () => {
    const character = makeCharacter({ spells: [{ name: 'Guidance', level: 0 }] });
    const sections = [
      { key: 'spells' as const, title: 'Spells' },
      { key: continuationKey('spells', 1), title: 'Spells (cont.)' },
    ];

    for (const section of sections) {
      const wrapper = mount(SectionCard, {
        props: {
          section: { ...section, count: 1, isEmpty: false },
          span: { cols: 3, rows: 2 },
          character,
        },
      });
      const legend = wrapper.get('.card__spell-legend');
      expect(legend.element.parentElement?.classList.contains('card__title')).toBe(true);
      expect(legend.findAll('.card__spell-legend-tag').map((tag) => tag.text())).toEqual([
        'C',
        'R',
        'V',
        'S',
        'M',
        'A',
        'BA',
      ]);
      expect(
        legend.findAll('.card__spell-legend-group').map((group) =>
          group.findAll('.card__spell-legend-item > span').map((label) => label.text()),
        ),
      ).toEqual([
        ['Concentration', 'Ritual'],
        ['Verbal', 'Somatic', 'Material'],
        ['Action', 'Bonus Action'],
      ]);
      const items = legend.findAll('.card__spell-legend-item');
      expect(items).toHaveLength(7);
      expect(legend.findAll('.card__spell-legend-sep').map((sep) => sep.text())).toEqual([
        '|',
        '|',
      ]);
      expect(
        legend.findAll('.card__spell-legend-tag--plain').map((tag) => tag.text()),
      ).toEqual(['V', 'S', 'M', 'A', 'BA']);
      expect(
        legend
          .findAll('.card__spell-legend-tag:not(.card__spell-legend-tag--plain)')
          .map((tag) => tag.text()),
      ).toEqual(['C', 'R']);
    }
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
          name: 'Noct',
          race: 'Elf',
          size: 'Medium',
          creatureType: 'Humanoid',
          classes: [{ name: 'Cleric', level: 4, subclass: 'Grave Domain' }],
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
    expect(wrapper.findAll('.card__title-sep')).toHaveLength(2);
    expect(wrapper.get('.card__meta').text()).toBe('Medium · Humanoid');
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

  it('dispatches companion and rules-table sections to their dedicated cards', () => {
    const character = makeCharacter({
      companions: [
        {
          name: 'Steel Defender',
          source: 'Steel Defender',
          abilities: [],
          details: [{ section: 'Actions', label: 'Rend', text: 'Melee Attack Roll.' }],
        },
      ],
      ruleTables: [
        {
          title: 'Experimental Elixir',
          source: 'Experimental Elixir',
          columns: ['d6', 'Effect'],
          rows: [['1', 'Healing']],
        },
      ],
    });
    const companionCard = mount(SectionCard, {
      props: {
        section: { key: 'companions', title: 'Companions', count: 2, isEmpty: false },
        span: { cols: 3, rows: 2 },
        character,
      },
    });
    const tableCard = mount(SectionCard, {
      props: {
        section: { key: 'tables', title: 'Tables', count: 1, isEmpty: false },
        span: { cols: 3, rows: 2 },
        character,
      },
    });

    expect(companionCard.get('[data-companion]').text()).toContain('Steel Defender');
    expect(tableCard.get('[data-rule-table]').text()).toContain('Experimental Elixir');
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

  it('uses feature parts instead of their parent as continuation break units', async () => {
    const rect = (top: number, bottom: number) => ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
    const gbcr = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList?.contains('card__body')) return rect(0, 300);
        if (this.hasAttribute?.('data-feature-part')) {
          return this.textContent?.includes('First Part') ? rect(20, 100) : rect(100, 200);
        }
        if (this.hasAttribute?.('data-feature')) {
          return this.querySelector('[data-feature-part]') ? rect(0, 220) : rect(220, 260);
        }
        return rect(0, 0);
      });
    class FakeResizeObserver {
      constructor(_callback: () => void) {}
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const character = makeCharacter({
      features: [
        {
          label: 'Class Features',
          items: [
            {
              name: 'Multipart Feature',
              parts: [
                { label: 'First Part', text: 'First detail.' },
                { label: 'Second Part', text: 'Second detail.' },
              ],
            },
            { name: 'Simple Feature' },
          ],
        },
      ],
    });
    const wrapper = mount(SectionCard, {
      props: {
        section: { key: 'features', title: 'Features & Traits', count: 2, isEmpty: false },
        span: { cols: 3, rows: 3 },
        character,
        rowAlignedFeatures: true,
      },
    });
    await flushPromises();
    await nextTick();

    const measured = wrapper.emitted('measure');
    const geometry = measured?.[measured.length - 1]?.[1] as
      | { breaks: number[] }
      | undefined;
    expect(geometry?.breaks).toEqual([100, 200, 260]);

    wrapper.unmount();

    const compactWrapper = mount(SectionCard, {
      props: {
        section: { key: 'features', title: 'Features & Traits', count: 2, isEmpty: false },
        span: { cols: 3, rows: 3 },
        character,
      },
    });
    await flushPromises();
    await nextTick();

    const compactMeasurements = compactWrapper.emitted('measure');
    const compactGeometry = compactMeasurements?.[compactMeasurements.length - 1]?.[1] as
      | { breaks: number[] }
      | undefined;
    expect(compactGeometry?.breaks).toEqual([220, 260]);

    compactWrapper.unmount();
    gbcr.mockRestore();
    vi.unstubAllGlobals();
  });
});
