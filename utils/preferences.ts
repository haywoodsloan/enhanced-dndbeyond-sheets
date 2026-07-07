/**
 * Persisted user preferences for the sheet: page format, margins, theme color,
 * and the custom section order. Stored in `browser.storage.local` (survives
 * across browser sessions). Only PREFERENCES live here — never character data
 * (the auth token keeps its own `storage.session`).
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
    const stored = await browser.storage.local.get(key);
    const value = stored[key] as T | undefined;
    if (value == null) return fallback;
    // If the caller expects an array, a legacy/corrupted object value (e.g. an
    // array once serialized as `{0:..,1:..}`) falls back rather than crashing.
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
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
    await browser.storage.local.set({ [key]: plain });
  } catch {
    // Storage unavailable (e.g. some test contexts) — preferences are best-effort.
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
