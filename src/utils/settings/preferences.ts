/**
 * Persisted user preferences for the sheet: page format, margins, theme color,
 * and the custom section order / hidden sections / per-card layout. Stored in
 * `browser.storage.sync` so they follow the user across devices when they're
 * signed in to the browser (and still persist locally when they aren't). Values
 * saved before syncing was added are migrated from `storage.local` on first
 * read. Only PREFERENCES live here — never character data (the auth token keeps
 * its own `storage.session`).
 */
import type { SectionKey } from '@/services/dndbeyond/model';
import { debugLog } from '@/utils/debug';

/** Read/write handle for a single stored preference value. */
export interface Preference<T> {
  /** The stored value, or `fallback` when nothing is saved yet. */
  get(fallback: T): Promise<T>;
  /** Persist a new value. */
  set(value: T): Promise<void>;
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    let value = (await browser.storage.sync.get(key))[key] as T | undefined;
    let migrated = false;
    if (value == null) {
      // Carry over a value saved before syncing was enabled.
      value = (await browser.storage.local.get(key))[key] as T | undefined;
      migrated = value != null;
    }
    if (value == null) return fallback;
    // If the caller expects an array, a legacy/corrupted object value (e.g. an
    // array once serialized as `{0:..,1:..}`) falls back rather than crashing.
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
    if (migrated) void write(key, value);
    return value;
  } catch (error) {
    debugLog('settings', 'preference read failed', { key, error });
    return fallback;
  }
}

const pendingWrites = new Set<Promise<void>>();
const profileFlushers = new Set<(profileId: string) => Promise<void>>();

export const profileWriteLock = (profileId: string): string => `profile-write::${profileId}`;

/**
 * Reserve the profile snapshot lock immediately, before a debounced edit is
 * written. Other extension contexts cannot snapshot past this pending edit.
 * The caller must commit (or cancel with an empty callback) within its max wait.
 */
export function reserveProfileWrite(profileId: string): (write: () => Promise<void>) => Promise<void> {
  let commit!: (write: () => Promise<void>) => void;
  const ready = new Promise<() => Promise<void>>((resolve) => { commit = resolve; });
  const writing = navigator.locks.request(
    profileWriteLock(profileId),
    { signal: AbortSignal.timeout(5_000) },
    async () => { await (await ready)(); },
  );
  void writing.catch(() => {
    debugLog('settings', 'profile write lock failed', { profileId });
  });
  return (write) => {
    commit(write);
    return writing;
  };
}

/** Register a mounted editor's debounced writes for profile duplication. */
export function registerProfileFlush(flush: (profileId: string) => Promise<void>): () => void {
  profileFlushers.add(flush);
  return () => { profileFlushers.delete(flush); };
}

/** Finish live edits before reading a profile's persisted snapshot. */
export async function flushProfileWrites(profileId: string): Promise<void> {
  await Promise.all([...profileFlushers].map((flush) => flush(profileId)));
  await Promise.all([...pendingWrites]);
}

function write<T>(key: string, value: T): Promise<void> {
  const writing = (async () => {
    try {
      // Storage must receive plain data rather than Vue reactive proxies.
      const plain = JSON.parse(JSON.stringify(value)) as T;
      await browser.storage.sync.set({ [key]: plain });
    } catch (error) {
      debugLog('settings', 'preference write failed', { key, error });
    }
  })();
  pendingWrites.add(writing);
  void writing.finally(() => pendingWrites.delete(writing));
  return writing;
}

function definePreference<T>(key: string): Preference<T> {
  return {
    get: (fallback: T) => read(key, fallback),
    set: (value: T) => write(key, value),
  };
}

/**
 * The always-present default profile's id. Its settings live at the ORIGINAL,
 * unscoped keys below, so a layout saved before profiles existed becomes the
 * Default profile automatically — no migration needed.
 */
export const DEFAULT_PROFILE_ID = 'default';

// Base storage keys for the per-profile layout settings.
export const PAGE_FORMAT_KEY = 'pref-page-format';
export const PAGE_MARGIN_KEY = 'pref-page-margin';
export const PAGE_ORIENTATION_KEY = 'pref-page-orientation';
export const THEME_COLOR_KEY = 'pref-theme-color';
export const HIDDEN_SECTIONS_KEY = 'pref-hidden-sections';
export const AUTO_SHOWN_SECTIONS_KEY = 'pref-auto-shown-sections';
export const SECTION_LAYOUT_KEY = 'pref-section-layout';
export const SECTION_ANCHORS_KEY = 'pref-section-anchors';
export const SPELLS_EXPANDED_KEY = 'pref-spells-expanded';

/** The storage key for a base preference under a given profile. The default
 * profile keeps the bare key (so pre-profiles saves map to it); other profiles
 * suffix the key with their id. */
export function scopedKey(base: string, profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? base : `${base}::${profileId}`;
}

/** A {@link Preference} for a base key scoped to a profile. */
export function scopedPreference<T>(base: string, profileId: string): Preference<T> {
  return definePreference<T>(scopedKey(base, profileId));
}

export const pageFormatPref = definePreference<string>(PAGE_FORMAT_KEY);
export const pageMarginPref = definePreference<string>(PAGE_MARGIN_KEY);
export const pageOrientationPref = definePreference<string>(PAGE_ORIENTATION_KEY);
export const themeColorPref = definePreference<string>(THEME_COLOR_KEY);
export const hiddenSectionsPref = definePreference<SectionKey[]>(HIDDEN_SECTIONS_KEY);
export const autoShownSectionsPref = definePreference<SectionKey[]>(AUTO_SHOWN_SECTIONS_KEY);
/** Per-section chosen layout-option index (section key → index). */
export const sectionLayoutPref = definePreference<Record<string, number>>(SECTION_LAYOUT_KEY);
/** Per-section placement: section key → the cell it was moved to + a recency
 * `seq` (higher = moved more recently, so it wins a contested cell). */
export const sectionAnchorsPref = definePreference<
  Record<string, { page: number; col: number; row: number; seq: number }>
>(SECTION_ANCHORS_KEY);

/** The list of saved profiles + which one is active (a single, global key, NOT
 * per-profile). Its `ProfilesState` type lives in `./profiles`. */
export const PROFILES_KEY = 'pref-profiles';
export const profilesPref = definePreference<{
  activeId: string;
  profiles: { id: string; name: string }[];
}>(PROFILES_KEY);
