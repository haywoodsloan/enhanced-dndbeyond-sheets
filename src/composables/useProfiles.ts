import { computed, onMounted, ref } from 'vue';
import { profilesPref } from '@/utils/settings/preferences';
import {
  DEFAULT_PROFILE,
  deleteProfileData,
  generateProfileId,
  type ProfileMeta,
} from '@/utils/settings/profiles';

/**
 * Reactive list of layout profiles and the active one, persisted to
 * `browser.storage.sync`. Each profile's actual settings live under
 * profile-scoped preference keys (the sheet loads them via the active id); this
 * composable only owns the metadata + which profile is active. There is always
 * at least the Default profile. Creating, switching, and deleting all persist
 * immediately (autosave).
 */
export function useProfiles() {
  const profiles = ref<ProfileMeta[]>([{ ...DEFAULT_PROFILE }]);
  const activeId = ref<string>(DEFAULT_PROFILE.id);
  let loaded = false;

  onMounted(async () => {
    const state = await profilesPref.get({ activeId: DEFAULT_PROFILE.id, profiles: [] });
    const list = Array.isArray(state.profiles) && state.profiles.length
      ? state.profiles
      : [{ ...DEFAULT_PROFILE }];
    profiles.value = list;
    activeId.value = list.some((profile) => profile.id === state.activeId)
      ? state.activeId
      : list[0].id;
    loaded = true;
  });

  // Persist the metadata (only after the initial load, so the implicit default
  // seed isn't written until the user actually changes something).
  function persist() {
    if (!loaded) return;
    void profilesPref.set({ activeId: activeId.value, profiles: profiles.value });
  }

  const activeProfile = computed(
    () => profiles.value.find((profile) => profile.id === activeId.value) ?? profiles.value[0],
  );

  /** Create a new (empty) profile and switch to it. */
  function create(name?: string) {
    const id = generateProfileId();
    const label = name?.trim() || `Profile ${profiles.value.length + 1}`;
    profiles.value = [...profiles.value, { id, name: label }];
    activeId.value = id;
    persist();
  }

  /** Make an existing profile the active one. */
  function switchTo(id: string) {
    if (id === activeId.value || !profiles.value.some((profile) => profile.id === id)) return;
    activeId.value = id;
    persist();
  }

  /** Delete a profile (never the last one) and drop its stored settings. */
  function remove(id: string) {
    if (profiles.value.length <= 1) return;
    const remaining = profiles.value.filter((profile) => profile.id !== id);
    profiles.value = remaining;
    if (activeId.value === id) activeId.value = remaining[0].id;
    persist();
    void deleteProfileData(id);
  }

  return { profiles, activeId, activeProfile, create, switchTo, remove };
}
