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
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  try {
    await browser.storage.local.set({ [key]: value });
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
