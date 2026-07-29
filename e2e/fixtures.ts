import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** The built, unpacked Chrome (MV3) extension the tests load. */
const extensionPath = resolve(rootDir, '.output/chrome-mv3');

/** A real D&D Beyond character payload — the same "Noct" fixture the unit tests use. */
export const noctRaw = JSON.parse(
  readFileSync(resolve(rootDir, 'tests/fixtures/noct.json'), 'utf-8'),
) as { id: number; customProficiencies?: { type: number; name: string }[] };

/**
 * Playwright fixtures that load the built extension into a persistent Chromium
 * context and expose its generated extension id. Extensions only run in a
 * persistent context launched with `--load-extension`; the new headless mode
 * (selected via `channel: 'chromium'`) supports them.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Playwright fixture callbacks require a destructured dependency object.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // The MV3 background service worker's URL carries the extension id.
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/**
 * Open the enhanced sheet with the D&D Beyond character-service response
 * mocked, so it renders deterministically with no network or auth token. Tests
 * may override the default Noct payload. Resolves once section cards are shown.
 */
export async function openSheet(
  context: BrowserContext,
  extensionId: string,
  rawCharacter: typeof noctRaw = noctRaw,
): Promise<Page> {
  const page = await context.newPage();
  await page.route('**/character-service.dndbeyond.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: rawCharacter.id,
        success: true,
        message: null,
        data: rawCharacter,
      }),
    }),
  );
  await page.goto(
    `chrome-extension://${extensionId}/sheet.html?characterId=${rawCharacter.id}`,
  );
  await page.locator('[data-section-key="attributes"]').waitFor();
  return page;
}
