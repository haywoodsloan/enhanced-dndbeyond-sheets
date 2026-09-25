import { locks } from 'node:worker_threads';
import { expect, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

/** Happy DOM leaves Web Locks unimplemented; use Node's shared lock manager. */
export function mockStorageLocks() {
  vi.spyOn(navigator, 'locks', 'get').mockReturnValue(locks as unknown as LockManager);
}

export async function settleStorageLocks() {
  await flushPromises();
  await vi.waitFor(async () => {
    const state = await locks.query();
    expect(state.held).toEqual([]);
    expect(state.pending).toEqual([]);
  }, { timeout: 1000, interval: 5 });
}
