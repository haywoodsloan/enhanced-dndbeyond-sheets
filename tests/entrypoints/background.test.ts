import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { getAuthToken } from '@/services/dndbeyond/auth-token';

/**
 * The background registers browser event listeners; fakeBrowser doesn't provide
 * contextMenus / webRequest, so we capture the registered callbacks through
 * lightweight stubs and invoke them directly.
 */
describe('background', () => {
  let onInstalled: () => void;
  let onHeaders: (details: { method?: string; url?: string; requestHeaders?: { name: string; value?: string }[] }) => unknown;
  let onClicked: (info: { menuItemId: string; pageUrl?: string }, tab?: { url?: string }) => void;
  const created: { id?: string; contexts?: string[] }[] = [];

  beforeEach(async () => {
    fakeBrowser.reset();
    created.length = 0;

    (fakeBrowser.runtime as unknown as { onInstalled: unknown }).onInstalled = {
      addListener: (fn: () => void) => {
        onInstalled = fn;
      },
    };
    (fakeBrowser as unknown as { contextMenus: unknown }).contextMenus = {
      create: (opts: { id?: string; contexts?: string[] }) => {
        created.push(opts);
      },
      onClicked: { addListener: (fn: typeof onClicked) => {
        onClicked = fn;
      } },
    };
    (fakeBrowser as unknown as { webRequest: unknown }).webRequest = {
      onBeforeSendHeaders: { addListener: (fn: typeof onHeaders) => {
        onHeaders = fn;
      } },
    };
    vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    vi.spyOn(fakeBrowser.runtime, 'getURL').mockReturnValue(
      'chrome-extension://id/sheet.html' as never,
    );

    vi.stubGlobal('defineBackground', (fn: () => void) => ({ main: fn }));
    const mod = (await import('@/entrypoints/background')) as { default: unknown };
    const bg = mod.default as (() => void) | { main: () => void };
    (typeof bg === 'function' ? bg : bg.main)();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates the context menu on install', () => {
    onInstalled();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ id: 'open-enhanced-sheet', contexts: ['page'] });
  });

  it('captures a new Authorization header and ignores repeats and empty ones', async () => {
    const headers = [{ name: 'Authorization', value: 'Bearer secret' }];
    onHeaders({ method: 'GET', url: 'https://character-service.dndbeyond.com/x', requestHeaders: headers });
    await vi.waitFor(async () => expect(await getAuthToken()).toBe('Bearer secret'));

    onHeaders({ requestHeaders: headers }); // duplicate — deduped
    onHeaders({ requestHeaders: [] }); // no header — ignored
    expect(await getAuthToken()).toBe('Bearer secret');
  });

  it('opens the enhanced sheet only for its own menu item', async () => {
    onClicked({ menuItemId: 'not-ours' });
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();

    onClicked({
      menuItemId: 'open-enhanced-sheet',
      pageUrl: 'https://www.dndbeyond.com/characters/123',
    });
    await vi.waitFor(() => expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(1));
  });

  it('ignores a click whose page URL has no character id', async () => {
    onClicked({ menuItemId: 'open-enhanced-sheet', pageUrl: 'https://www.dndbeyond.com/' });
    await Promise.resolve();
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
  });
});
