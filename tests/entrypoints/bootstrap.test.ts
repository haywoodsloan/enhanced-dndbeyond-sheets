import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

/**
 * Smoke tests for the entrypoint bootstraps: importing them mounts the Vue app
 * into `#app`. They exercise the `createApp(...).mount(...)` wiring that the
 * component tests (which mount the app directly) don't.
 */
describe('entrypoint bootstraps', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '<div id="app"></div>';
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([] as never);
    vi.resetModules();
  });

  it('mounts the popup app into #app', async () => {
    await import('@/entrypoints/popup/main');
    expect(document.querySelector('#app')?.querySelector('.popup')).not.toBeNull();
  });

  it('mounts the sheet app into #app', async () => {
    await import('@/entrypoints/sheet/main');
    expect((document.querySelector('#app')?.innerHTML.length ?? 0)).toBeGreaterThan(0);
  });
});
