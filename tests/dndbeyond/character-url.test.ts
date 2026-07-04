import { describe, it, expect } from 'vitest';
import { isCharacterUrl, parseCharacterId } from '@/services/dndbeyond/character-url';

describe('parseCharacterId', () => {
  it('parses a basic character url', () => {
    expect(parseCharacterId('https://www.dndbeyond.com/characters/166869100')).toBe(
      166869100,
    );
  });

  it('parses without the www subdomain', () => {
    expect(parseCharacterId('https://dndbeyond.com/characters/42')).toBe(42);
  });

  it('parses with a trailing sub-path', () => {
    expect(
      parseCharacterId('https://www.dndbeyond.com/characters/166869100/builder'),
    ).toBe(166869100);
  });

  it('parses with query and hash', () => {
    expect(parseCharacterId('https://www.dndbeyond.com/characters/7?tab=1#notes')).toBe(7);
  });

  it('parses http as well as https', () => {
    expect(parseCharacterId('http://www.dndbeyond.com/characters/9')).toBe(9);
  });

  it('returns null for non-character dndbeyond pages', () => {
    expect(parseCharacterId('https://www.dndbeyond.com/campaigns/123')).toBeNull();
  });

  it('returns null for other domains', () => {
    expect(parseCharacterId('https://example.com/characters/123')).toBeNull();
  });

  it('returns null for look-alike domains', () => {
    expect(parseCharacterId('https://evildndbeyond.com/characters/123')).toBeNull();
    expect(parseCharacterId('https://www.dndbeyond.com.evil.com/characters/123')).toBeNull();
  });

  it('returns null when the id is missing', () => {
    expect(parseCharacterId('https://www.dndbeyond.com/characters/')).toBeNull();
  });

  it('returns null for null, undefined, or empty input', () => {
    expect(parseCharacterId(null)).toBeNull();
    expect(parseCharacterId(undefined)).toBeNull();
    expect(parseCharacterId('')).toBeNull();
  });
});

describe('isCharacterUrl', () => {
  it('is true for a character url', () => {
    expect(isCharacterUrl('https://www.dndbeyond.com/characters/1')).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isCharacterUrl('https://www.dndbeyond.com/')).toBe(false);
  });
});
