import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { useGridFlip } from '@/composables/useGridFlip';

/** Mount a container of `.card`s driven by an `order` ref through useGridFlip. */
function makeHarness() {
  const order = ref(0);
  const wrapper = mount(
    defineComponent({
      setup() {
        const container = ref<HTMLElement | null>(null);
        useGridFlip(container, order);
        return () =>
          h('div', { ref: container }, [
            h('div', { class: 'card', 'data-section-key': 'a' }),
            h('div', { class: 'card', 'data-section-key': 'b' }),
            h('div', { class: 'card' }), // no key → ignored by the FLIP
          ]);
      },
    }),
  );
  const cards = () => Array.from(wrapper.element.querySelectorAll('.card')) as HTMLElement[];
  return { wrapper, order, cards };
}

describe('useGridFlip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('snaps without a transform when reduced motion is preferred', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { order, cards } = makeHarness();

    order.value = 1;
    await flushPromises();
    expect(cards().every((card) => card.style.transform === '')).toBe(true);
  });

  it('glides moved cards, then clears the transform on transitionend', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    // Each card reports a different rect before (0) vs after (100) so the FLIP
    // sees a move; non-card elements report zeros.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!this.classList?.contains('card')) return new DOMRect();
      const seen = ((this as unknown as { _n?: number })._n ?? -1) + 1;
      (this as unknown as { _n: number })._n = seen;
      const left = seen === 0 ? 0 : 100;
      return { left, top: 0, right: left + 50, bottom: 50, width: 50, height: 50, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    // Run the requestAnimationFrame callback synchronously.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const { order, cards } = makeHarness();
    order.value = 1;
    await flushPromises();

    const [cardA] = cards();
    expect(cardA.style.transition).toContain('transform');

    cardA.dispatchEvent(new Event('transitionend'));
    expect(cardA.style.transition).toBe('');
    expect(cardA.style.transform).toBe('');
  });

  it('tears down its listeners on unmount without error', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const { wrapper, order } = makeHarness();
    order.value = 1;
    await flushPromises();
    expect(() => wrapper.unmount()).not.toThrow();
  });
});
