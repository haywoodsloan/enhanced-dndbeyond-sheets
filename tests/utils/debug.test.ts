import { describe, expect, it, vi } from 'vitest';
import { debugLog, redactForLog } from '@/utils/debug';

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

  it('redacts secrets nested inside arrays', () => {
    expect(redactForLog(['fine', 'Bearer a.b.c'])).toEqual([
      'fine',
      expect.stringMatching(/^\[redacted/),
    ]);
  });
});

describe('debugLog', () => {
  it('logs a namespaced message with and without data, redacting secrets', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('test', 'plain message');
    debugLog('test', 'with data', { authorization: 'secret-value' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('[EDB test] plain message');
    expect(spy.mock.calls[1][1]).toEqual({
      authorization: expect.stringMatching(/^\[redacted/),
    });
    spy.mockRestore();
  });
});
