import { describe, it, expect } from 'vitest';
import {
  CHARACTER_ID_PARAM,
  SHEET_PAGE,
  enhancedSheetUrl,
  parseSheetCharacterId,
} from '@/utils/sheet-url';

describe('enhancedSheetUrl', () => {
  it('builds a sheet url carrying the character id', () => {
    const url = enhancedSheetUrl(166869100);
    expect(url).toContain('sheet.html');
    expect(url).toContain('characterId=166869100');
  });
});

describe('parseSheetCharacterId', () => {
  it('reads the id from an absolute extension url', () => {
    expect(
      parseSheetCharacterId('chrome-extension://abc/sheet.html?characterId=166869100'),
    ).toBe(166869100);
  });

  it('reads the id from a relative url', () => {
    expect(parseSheetCharacterId('sheet.html?characterId=42')).toBe(42);
  });

  it('returns null when the param is missing', () => {
    expect(parseSheetCharacterId('sheet.html')).toBeNull();
  });

  it('returns null for non-numeric or non-positive ids', () => {
    expect(parseSheetCharacterId('sheet.html?characterId=abc')).toBeNull();
    expect(parseSheetCharacterId('sheet.html?characterId=0')).toBeNull();
    expect(parseSheetCharacterId('sheet.html?characterId=-5')).toBeNull();
  });

  it('returns null for null or undefined', () => {
    expect(parseSheetCharacterId(null)).toBeNull();
    expect(parseSheetCharacterId(undefined)).toBeNull();
  });
});

describe('constants', () => {
  it('exposes the page and param names', () => {
    expect(SHEET_PAGE).toBe('sheet.html');
    expect(CHARACTER_ID_PARAM).toBe('characterId');
  });
});
