import { describe, expect, it } from 'vitest';
import { redactForLog } from '@/utils/debug';

describe('redactForLog', () => {
  it('redacts bearer tokens and JWT-shaped strings', () => {
    expect(redactForLog('Bearer abc.def.ghi')).toMatch(/^\[redacted/);
    expect(redactForLog('eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM')).toMatch(/^\[redacted/);
  });

  it('redacts values under sensitive keys regardless of shape', () => {
    expect(redactForLog({ authorization: 'anything-here' })).toEqual({
      authorization: expect.stringMatching(/^\[redacted/),
    });
    expect(redactForLog({ token: 'shhh' })).toEqual({
      token: expect.stringMatching(/^\[redacted/),
    });
  });

  it('keeps ordinary strings, urls, numbers, and booleans', () => {
    const data = {
      url: 'https://character-service.dndbeyond.com/character/v5/character/1',
      scheme: 'Bearer',
      length: 1467,
      hasAuthorization: true,
    };
    expect(redactForLog(data)).toEqual(data);
  });
});
