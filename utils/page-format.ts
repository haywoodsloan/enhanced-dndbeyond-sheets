/**
 * Common printer paper sizes and margin presets for the page layout settings.
 * Dimensions are portrait millimeters (the canonical unit); helpers convert to
 * CSS pixels for the pagination math. The on-screen paper and the print `@page`
 * rule are both driven from these so the aspect ratio always matches the type.
 */

export interface PageFormat {
  id: string;
  name: string;
  /** Width in millimeters (portrait). */
  width: number;
  /** Height in millimeters (portrait). */
  height: number;
}

/** Common printer paper sizes worldwide, portrait orientation. */
export const PAGE_FORMATS: readonly PageFormat[] = [
  { id: 'letter', name: 'Letter (8.5 × 11 in)', width: 215.9, height: 279.4 },
  { id: 'legal', name: 'Legal (8.5 × 14 in)', width: 215.9, height: 355.6 },
  { id: 'tabloid', name: 'Tabloid (11 × 17 in)', width: 279.4, height: 431.8 },
  { id: 'executive', name: 'Executive (7.25 × 10.5 in)', width: 184.15, height: 266.7 },
  { id: 'a3', name: 'A3 (297 × 420 mm)', width: 297, height: 420 },
  { id: 'a4', name: 'A4 (210 × 297 mm)', width: 210, height: 297 },
  { id: 'a5', name: 'A5 (148 × 210 mm)', width: 148, height: 210 },
  { id: 'b4', name: 'B4 (250 × 353 mm)', width: 250, height: 353 },
  { id: 'b5', name: 'B5 (176 × 250 mm)', width: 176, height: 250 },
];

export const DEFAULT_FORMAT_ID = 'letter';

export interface MarginPreset {
  id: string;
  name: string;
  /** Margin in millimeters. */
  mm: number;
}

export const MARGIN_PRESETS: readonly MarginPreset[] = [
  { id: 'none', name: 'None', mm: 0 },
  { id: 'narrow', name: 'Narrow (6 mm)', mm: 6 },
  { id: 'normal', name: 'Normal (13 mm)', mm: 13 },
  { id: 'wide', name: 'Wide (19 mm)', mm: 19 },
];

export const DEFAULT_MARGIN_ID = 'normal';

/** CSS pixels per millimeter (96 px per inch ÷ 25.4 mm per inch). */
export const PX_PER_MM = 96 / 25.4;

/** Convert a millimeter length to CSS pixels. */
export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}
