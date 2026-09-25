import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { DEFAULT_PROFILE_ID, scopedPreference } from '@/utils/settings/preferences';

/**
 * A `ref` synced to a profile-scoped preference: it loads the active profile's
 * stored value on mount (and reloads whenever the active profile changes), and
 * writes back to that profile whenever the ref changes. Until a load resolves
 * the ref holds `fallback`, and a freshly-loaded value is not re-persisted.
 *
 * @param base The base preference key (scoped to the profile internally).
 * @param fallback The value used until the stored one loads / when none is saved.
 * @param profileId The active profile id; changing it reloads from that profile.
 */
export function useStoredRef<T>(
  base: string,
  fallback: T,
  profileId: Ref<string> = ref(DEFAULT_PROFILE_ID),
): Ref<T> {
  const state = ref(fallback) as Ref<T>;
  // Suppress the write-back while a load is assigning the ref, so loading a
  // value (initially or on a profile switch) never persists it straight back.
  let suppress = true;
  let generation = 0;
  let loadedProfileId: string | undefined;

  async function load() {
    const currentGeneration = ++generation;
    const id = profileId.value;
    loadedProfileId = undefined;
    suppress = true;
    const value = await scopedPreference<T>(base, id).get(fallback);
    if (generation !== currentGeneration || id !== profileId.value) return;
    state.value = value;
    loadedProfileId = id;
    suppress = false;
  }

  watch(
    state,
    (value) => {
      if (!suppress && loadedProfileId === profileId.value) {
        void scopedPreference<T>(base, loadedProfileId).set(value);
      }
    },
    { flush: 'sync' },
  );

  onMounted(load);
  // Reload from the newly-active profile when it changes.
  watch(profileId, load, { flush: 'sync' });
  onBeforeUnmount(() => {
    generation += 1;
    loadedProfileId = undefined;
    suppress = true;
  });

  return state;
}
