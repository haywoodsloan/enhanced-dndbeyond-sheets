import { defineConfig } from '@playwright/test';

// End-to-end tests load the BUILT Chrome extension and drive the enhanced sheet
// in a real browser. That real layout engine is the whole point: the pointer-
// driven card drag (positions, page breaks, displacement, persistence) can't be
// exercised in the vitest/happy-dom unit tests, which have no layout.
//
// The suite needs `.output/chrome-mv3` to exist — `npm run test:e2e` builds it
// first. Run a single worker so each test owns an isolated extension context.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
  },
});
