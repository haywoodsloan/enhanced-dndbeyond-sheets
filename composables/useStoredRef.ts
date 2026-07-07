import { onMounted, ref, watch, type Ref } from 'vue';
import type { Preference } from '@/utils/preferences';

/**
 * A `ref` synced to a persisted {@link Preference}: it loads the stored value
 * on mount and writes back whenever the ref changes. Until the initial load
 * resolves the ref holds `fallback`, and the loaded value is not re-persisted.
 */
export function useStoredRef<T>(preference: Preference<T>, fallback: T): Ref<T> {
  const state = ref(fallback) as Ref<T>;
  let loaded = false;

  onMounted(async () => {
    state.value = await preference.get(fallback);
    loaded = true;
  });

  watch(state, (value) => {
    if (loaded) void preference.set(value);
  });

  return state;
}
