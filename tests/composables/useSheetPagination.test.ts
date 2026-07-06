import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { useSheetPagination } from '@/composables/useSheetPagination';

// happy-dom does not do layout (rects are zero), so this is a smoke test that
// the lifecycle glue runs and tears down cleanly. The layout math is covered by
// the pure `paginate` tests.
describe('useSheetPagination', () => {
  it('mounts and unmounts without throwing', async () => {
    const Comp = defineComponent({
      setup() {
        const sheet = ref<HTMLElement | null>(null);
        const grid = ref<HTMLElement | null>(null);
        const { apply } = useSheetPagination(
          sheet,
          grid,
          () => ({ band: 1000, gutter: 20, margin: 50 }),
          () => 0,
        );
        return () => h('main', { ref: sheet }, [h('div', { ref: grid })]);
      },
    });

    const wrapper = mount(Comp);
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });
});
