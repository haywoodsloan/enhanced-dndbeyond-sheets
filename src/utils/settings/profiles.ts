/**
 * Layout profiles: named snapshots of the sheet's layout settings (page format,
 * margins, theme color, hidden sections, card layouts, and card placements).
 * A profile's settings live under profile-scoped storage keys (see
 * `scopedPreference`); this module holds the profile metadata and cleanup. The
 * always-present Default profile uses the original unscoped keys, so a layout
 * built before profiles existed becomes the Default profile with no migration.
 */
import {
  DEFAULT_PROFILE_ID,
  HIDDEN_SECTIONS_KEY,
  PAGE_FORMAT_KEY,
  PAGE_MARGIN_KEY,
  PAGE_ORIENTATION_KEY,
  SECTION_ANCHORS_KEY,
  SECTION_LAYOUT_KEY,
  SPELLS_EXPANDED_KEY,
  THEME_COLOR_KEY,
  scopedKey,
} from './preferences';

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

/** The base keys whose values are per-profile — removed when a profile is deleted. */
const PROFILE_SCOPED_BASES = [
  PAGE_FORMAT_KEY,
  PAGE_MARGIN_KEY,
  PAGE_ORIENTATION_KEY,
  THEME_COLOR_KEY,
  HIDDEN_SECTIONS_KEY,
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
  } catch {
    // Best-effort cleanup; ignore storage errors.
  }
}

/**
 * Copy every stored setting from one profile to another (best-effort) — used to
 * duplicate a profile so the copy starts identical to its source.
 */
export async function copyProfileData(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;
  try {
    const stored = await browser.storage.sync.get(
      PROFILE_SCOPED_BASES.map((base) => scopedKey(base, fromId)),
    );
    const writes: Record<string, unknown> = {};
    for (const base of PROFILE_SCOPED_BASES) {
      const value = stored[scopedKey(base, fromId)];
      if (value !== undefined) writes[scopedKey(base, toId)] = value;
    }
    if (Object.keys(writes).length) await browser.storage.sync.set(writes);
  } catch {
    // Best-effort copy; ignore storage errors.
  }
}
