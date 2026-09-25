/**
 * Layout profiles: named snapshots of the sheet's layout settings (page format,
 * margins, theme color, hidden sections, card layouts, and card placements).
 * A profile's settings live under profile-scoped storage keys (see
 * `scopedPreference`); this module holds the profile metadata and cleanup. The
 * always-present Default profile uses the original unscoped keys, so a layout
 * built before profiles existed becomes the Default profile with no migration.
 */
import {
  AUTO_SHOWN_SECTIONS_KEY,
  DEFAULT_PROFILE_ID,
  HIDDEN_SECTIONS_KEY,
  PAGE_FORMAT_KEY,
  PAGE_MARGIN_KEY,
  PAGE_ORIENTATION_KEY,
  SECTION_ANCHORS_KEY,
  SECTION_LAYOUT_KEY,
  SPELLS_EXPANDED_KEY,
  THEME_COLOR_KEY,
  PROFILES_KEY,
  flushProfileWrites,
  profilesPref,
  profileWriteLock,
  scopedKey,
} from './preferences';
import { debugLog } from '@/utils/debug';

/** A saved profile's metadata (its settings live under scoped keys). */
export interface ProfileMeta {
  id: string;
  name: string;
}

/** The persisted profile list plus which profile is active. */
export interface ProfilesState {
  activeId: string;
  profiles: ProfileMeta[];
}

/** The default profile that always exists (its settings are the unscoped keys). */
export const DEFAULT_PROFILE: ProfileMeta = { id: DEFAULT_PROFILE_ID, name: 'Default' };

/** Validate persisted metadata before it reaches the profile picker. */
export function normalizeProfilesState(value: unknown): ProfilesState {
  const state = value && typeof value === 'object' ? value as Partial<ProfilesState> : {};
  const entries = Array.isArray(state.profiles) ? state.profiles : [];
  const ids = new Set<string>();
  const profiles = entries.filter((profile): profile is ProfileMeta => {
    if (
      !profile || typeof profile !== 'object' ||
      typeof profile.id !== 'string' || !profile.id.trim() ||
      typeof profile.name !== 'string' || !profile.name.trim() ||
      ids.has(profile.id)
    ) return false;
    ids.add(profile.id);
    return true;
  });
  if (!Array.isArray(state.profiles) || profiles.length !== entries.length) {
    debugLog('settings', 'invalid stored profile metadata');
  }
  if (!profiles.length) profiles.push({ ...DEFAULT_PROFILE });
  return {
    profiles,
    activeId: profiles.some((profile) => profile.id === state.activeId)
      ? state.activeId!
      : profiles[0].id,
  };
}

/** Rebase a metadata edit under a lock shared by all open extension sheets. */
export async function updateProfilesState(
  update: (state: ProfilesState) => ProfilesState,
): Promise<ProfilesState> {
  return navigator.locks.request(PROFILES_KEY, async () => {
    // A failed read is not an empty store: never overwrite metadata with the
    // fallback used by best-effort display preferences.
    let stored = (await browser.storage.sync.get(PROFILES_KEY))[PROFILES_KEY];
    if (stored == null) stored = (await browser.storage.local.get(PROFILES_KEY))[PROFILES_KEY];
    const current = normalizeProfilesState(stored ?? {
      activeId: DEFAULT_PROFILE.id,
      profiles: [],
    });
    const next = update(current);
    await profilesPref.set(next);
    return next;
  });
}

/** The base keys whose values are per-profile — removed when a profile is deleted. */
const PROFILE_SCOPED_BASES = [
  PAGE_FORMAT_KEY,
  PAGE_MARGIN_KEY,
  PAGE_ORIENTATION_KEY,
  THEME_COLOR_KEY,
  HIDDEN_SECTIONS_KEY,
  AUTO_SHOWN_SECTIONS_KEY,
  SECTION_LAYOUT_KEY,
  SECTION_ANCHORS_KEY,
  SPELLS_EXPANDED_KEY,
];

/** A unique id for a new profile. */
export function generateProfileId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A unique "{base} copy" name for a duplicated profile. Strips an existing
 * " copy"/" copy N" suffix so duplicating a copy re-bases (avoids "copy copy"),
 * then returns the first free " copy" / " copy 2" / " copy 3" … not already taken.
 */
export function uniqueProfileCopyName(
  sourceName: string,
  existingNames: readonly string[],
): string {
  const root = sourceName.replace(/ copy(?: \d+)?$/, '').trim() || sourceName.trim();
  const taken = new Set(existingNames);
  let candidate = `${root} copy`;
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${root} copy ${n}`;
  return candidate;
}

/**
 * Remove a deleted profile's stored settings (best-effort). The default
 * profile's keys are the shared, unscoped ones, so they are never removed.
 */
export async function deleteProfileData(id: string): Promise<void> {
  if (id === DEFAULT_PROFILE_ID) return;
  const keys = PROFILE_SCOPED_BASES.map((base) => scopedKey(base, id));
  try {
    await browser.storage.sync.remove(keys);
    await browser.storage.local.remove(keys);
  } catch (error) {
    debugLog('settings', 'profile cleanup failed', { id, error });
  }
}

/**
 * Copy a profile after pending placements in every open sheet have settled.
 * Failure (including a stalled source) rejects so no empty duplicate is added.
 */
export async function copyProfileData(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;
  const controller = new AbortController();
  let deadline!: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => {
      controller.abort();
      reject(new Error('Profile copy timed out'));
    }, 5_000);
  });
  try {
    await Promise.race([
      timedOut,
      (async () => {
        await flushProfileWrites(fromId);
        controller.signal.throwIfAborted();
        await navigator.locks.request(
          profileWriteLock(fromId),
          { signal: controller.signal },
          async () => {
            const stored = await browser.storage.sync.get(
              PROFILE_SCOPED_BASES.map((base) => scopedKey(base, fromId)),
            );
            controller.signal.throwIfAborted();
            const writes: Record<string, unknown> = {};
            for (const base of PROFILE_SCOPED_BASES) {
              const value = stored[scopedKey(base, fromId)];
              if (value !== undefined) writes[scopedKey(base, toId)] = value;
            }
            if (Object.keys(writes).length) await browser.storage.sync.set(writes);
          },
        );
      })(),
    ]);
  } catch (error) {
    debugLog('settings', 'profile copy failed', { fromId, toId, error });
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}
