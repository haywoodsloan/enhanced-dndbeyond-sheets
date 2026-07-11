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
  SECTION_ANCHORS_KEY,
  SECTION_LAYOUT_KEY,
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
  THEME_COLOR_KEY,
  HIDDEN_SECTIONS_KEY,
  SECTION_LAYOUT_KEY,
  SECTION_ANCHORS_KEY,
];

/** A unique id for a new profile. */
export function generateProfileId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
