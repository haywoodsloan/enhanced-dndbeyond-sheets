import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { PROFILES_KEY, profilesPref } from '@/utils/settings/preferences';
import {
  DEFAULT_PROFILE,
  copyProfileData,
  deleteProfileData,
  generateProfileId,
  normalizeProfilesState,
  updateProfilesState,
  uniqueProfileCopyName,
  type ProfileMeta,
  type ProfilesState,
} from '@/utils/settings/profiles';
import { debugLog } from '@/utils/debug';

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
  let disposed = false;
  let revision = 0;
  type Update = (state: ProfilesState) => ProfilesState;
  const pending = new Set<Update>();
  let finishInitialLoad!: () => void;
  let writes = new Promise<void>((resolve) => { finishInitialLoad = resolve; });

  function apply(state: ProfilesState) {
    profiles.value = state.profiles;
    activeId.value = state.activeId;
  }

  function reconcile(state: ProfilesState) {
    for (const update of pending) state = update(state);
    apply(state);
  }

  function onChanged(changes: Record<string, { newValue?: unknown }>, area: string) {
    if (area !== 'sync' || !(PROFILES_KEY in changes)) return;
    revision += 1;
    reconcile(normalizeProfilesState(changes[PROFILES_KEY].newValue));
  }

  onMounted(async () => {
    browser.storage.onChanged.addListener(onChanged);
    const initialRevision = revision;
    const state = await profilesPref.get({ activeId: DEFAULT_PROFILE.id, profiles: [] });
    if (!disposed && revision === initialRevision) reconcile(normalizeProfilesState(state));
    finishInitialLoad();
  });

  onBeforeUnmount(() => {
    disposed = true;
    browser.storage.onChanged.removeListener(onChanged);
  });

  // Keep the synchronous picker API, but persist operations against the latest
  // metadata rather than replacing other sheets' edits with a stale snapshot.
  // Early actions queue behind initialization instead of being discarded.
  function mutate(update: Update, afterPersist?: (state: ProfilesState) => Promise<void>) {
    apply(update({ activeId: activeId.value, profiles: profiles.value }));
    pending.add(update);
    writes = writes.then(async () => {
      try {
        const state = await updateProfilesState(update);
        pending.delete(update);
        if (!disposed) reconcile(state);
        await afterPersist?.(state);
      } finally {
        pending.delete(update);
      }
    }).catch(() => {
      debugLog('settings', 'profile metadata update failed');
    });
    return writes;
  }

  const activeProfile = computed(
    () => profiles.value.find((profile) => profile.id === activeId.value) ?? profiles.value[0],
  );

  /** Create a new (empty) profile, switch to it, and return its id. */
  function create(name?: string): string {
    const id = generateProfileId();
    const label = name?.trim() || `Profile ${profiles.value.length + 1}`;
    void mutate((state) => ({
      activeId: id,
      profiles: state.profiles.some((profile) => profile.id === id)
        ? state.profiles
        : [...state.profiles, { id, name: label }],
    }));
    return id;
  }

  /** Duplicate a profile: copy its settings into a new profile, then switch to
   * it. Copies BEFORE switching so the reload reads the copied data. */
  async function duplicate(id: string) {
    await writes;
    const source = profiles.value.find((profile) => profile.id === id);
    if (!source) return;
    const newId = generateProfileId();
    try {
      await copyProfileData(id, newId);
    } catch {
      return;
    }
    await mutate((state) => {
      if (state.profiles.some((profile) => profile.id === newId)) return { ...state, activeId: newId };
      const currentSource = state.profiles.find((profile) => profile.id === id);
      if (!currentSource) return state;
      const name = uniqueProfileCopyName(currentSource.name, state.profiles.map((profile) => profile.name));
      return { activeId: newId, profiles: [...state.profiles, { id: newId, name }] };
    });
  }

  /** Rename a profile, ignoring blank names and no-op renames. */
  function rename(id: string, name: string) {
    const label = name.trim();
    if (!label) return;
    const target = profiles.value.find((profile) => profile.id === id);
    if (!target || target.name === label) return;
    void mutate((state) => ({
      ...state,
      profiles: state.profiles.map((profile) =>
        profile.id === id ? { ...profile, name: label } : profile,
      ),
    }));
  }

  /** Move a profile to a target index in the list (for drag-reordering). */
  function moveTo(id: string, index: number) {
    const from = profiles.value.findIndex((profile) => profile.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(index, profiles.value.length - 1));
    if (from === to) return;
    void mutate((state) => {
      const position = state.profiles.findIndex((profile) => profile.id === id);
      if (position < 0) return state;
      const next = [...state.profiles];
      const [item] = next.splice(position, 1);
      next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
      return { ...state, profiles: next };
    });
  }

  /** Make an existing profile the active one. */
  function switchTo(id: string) {
    if (id === activeId.value || !profiles.value.some((profile) => profile.id === id)) return;
    void mutate((state) => state.profiles.some((profile) => profile.id === id)
      ? { ...state, activeId: id }
      : state);
  }

  /** Delete a profile (never the last one) and drop its stored settings. */
  function remove(id: string) {
    if (profiles.value.length <= 1) return;
    void mutate((state) => {
      if (state.profiles.length <= 1) return state;
      const remaining = state.profiles.filter((profile) => profile.id !== id);
      return {
        profiles: remaining,
        activeId: state.activeId === id ? remaining[0].id : state.activeId,
      };
    }, async (state) => {
      if (!state.profiles.some((profile) => profile.id === id)) await deleteProfileData(id);
    });
  }

  return {
    profiles,
    activeId,
    activeProfile,
    create,
    duplicate,
    rename,
    moveTo,
    switchTo,
    remove,
  };
}
