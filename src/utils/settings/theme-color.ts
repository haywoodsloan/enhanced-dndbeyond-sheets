/**
 * Selectable primary theme colors for the page customization panel. Each has a
 * base hex from which PrimeVue generates a full tonal palette at runtime.
 */

export interface ThemeColor {
  id: string;
  name: string;
  /** Base hex used to generate the primary palette. */
  base: string;
}

export const THEME_COLORS: readonly ThemeColor[] = [
  { id: 'blue', name: 'Blue', base: '#3b82f6' },
  { id: 'emerald', name: 'Emerald', base: '#10b981' },
  { id: 'violet', name: 'Violet', base: '#8b5cf6' },
  { id: 'rose', name: 'Rose', base: '#f43f5e' },
  { id: 'amber', name: 'Amber', base: '#f59e0b' },
  { id: 'cyan', name: 'Cyan', base: '#06b6d4' },
  { id: 'slate', name: 'Slate', base: '#64748b' },
];

export const DEFAULT_COLOR_ID = 'blue';
