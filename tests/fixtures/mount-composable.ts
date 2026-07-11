import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';

/**
 * Mount a throwaway component that runs `composable` in its `setup`, so the
 * lifecycle hooks it registers (`onMounted`, `onBeforeUnmount`, …) actually
 * fire. Returns the composable's result plus the wrapper — call
 * `wrapper.unmount()` to trigger teardown hooks.
 */
export function mountComposable<T>(composable: () => T): {
  result: T;
  wrapper: VueWrapper;
} {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable();
        return () => h('div');
      },
    }),
  );
  return { result, wrapper };
}
