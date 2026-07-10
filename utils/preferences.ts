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
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  try {
    // Normalize away Vue reactive proxies (and other wrappers) so an array is
    // stored as an array — a proxied array can otherwise serialize to an object.
    const plain = JSON.parse(JSON.stringify(value)) as T;
    await browser.storage.sync.set({ [key]: plain });
  } catch {
    // Storage unavailable / sync quota hit — preferences are best-effort.
  }
}

function definePreference<T>(key: string): Preference<T> {
  return {
    get: (fallback: T) => read(key, fallback),
    set: (value: T) => write(key, value),
  };
}

export const pageFormatPref = definePreference<string>('pref-page-format');
export const pageMarginPref = definePreference<string>('pref-page-margin');
export const themeColorPref = definePreference<string>('pref-theme-color');
export const sectionOrderPref = definePreference<SectionKey[]>('pref-section-order');
export const hiddenSectionsPref = definePreference<SectionKey[]>('pref-hidden-sections');
/** Per-section chosen layout-option index (section key → index). */
export const sectionLayoutPref = definePreference<Record<string, number>>('pref-section-layout');
/** Per-section placement: section key → the cell it was moved to + a recency
 * `seq` (higher = moved more recently, so it wins a contested cell). */
export const sectionAnchorsPref = definePreference<
  Record<string, { page: number; col: number; row: number; seq: number }>
>('pref-section-anchors');
