import { expect, openSheet, test } from './fixtures';
import { settle } from './helpers';

test.describe('layout profiles', () => {
  test('duplicating from another sheet waits for its source’s pending placements', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(45_000);
    const [source, destination] = await Promise.all([
      openSheet(context, extensionId),
      openSheet(context, extensionId),
    ]);
    await settle(source);
    await source.clock.install();
    await source.clock.pauseAt(new Date(Date.now() + 1_000));
    await source.locator('.settings__button--compact').click({ timeout: 5_000 });
    await destination.locator('.profiles__item--active .profiles__dupe').click({ timeout: 5_000 });
    await expect.poll(() => destination.evaluate(async () =>
      (await navigator.locks.query()).pending?.some((lock) => lock.name === 'profile-write::default'),
    ), { timeout: 3_000 }).toBe(true);
    await expect(destination.locator('.profiles__switch')).toHaveCount(1);

    await source.clock.runFor(500);
    await expect(destination.locator('.profiles__item--active .profiles__switch'))
      .toHaveText('Default copy');
    const snapshot = await destination.evaluate(async () => {
      const extension = (globalThis as unknown as {
        chrome: { storage: { sync: { get(keys: string[]): Promise<Record<string, unknown>> } } };
      }).chrome;
      const metadata = (await extension.storage.sync.get(['pref-profiles']))['pref-profiles'] as {
        activeId: string;
      };
      const copyKey = `pref-section-anchors::${metadata.activeId}`;
      const values = await extension.storage.sync.get(['pref-section-anchors', copyKey]);
      return { original: values['pref-section-anchors'], copy: values[copyKey] };
    });
    expect(snapshot.original).toBeTruthy();
    expect(Object.keys(snapshot.original as object).length).toBeGreaterThan(0);
    expect(snapshot.copy).toEqual(snapshot.original);
  });

  test('two open sheets preserve each other’s profile creates and renames after reload', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(60_000);
    const [first, second] = await Promise.all([
      openSheet(context, extensionId),
      openSheet(context, extensionId),
    ]);
    for (const page of [first, second]) {
      page.setDefaultTimeout(5_000);
      page.setDefaultNavigationTimeout(15_000);
      await expect(page.locator('.profiles__switch')).toHaveText(['Default']);
    }

    await first.locator('.profiles__new').click();
    await first.locator('.profiles__rename-input').fill('Print layout');
    await first.locator('.profiles__rename-input').press('Enter');
    // The other already-open sheet must observe the committed metadata before
    // editing its own list; no reload or timing-based sleep hides stale state.
    await expect(second.locator('.profiles__switch')).toHaveText(['Default', 'Print layout']);

    await second.locator('.profiles__new').click();
    await second.locator('.profiles__rename-input').fill('Screen layout');
    await second.locator('.profiles__rename-input').press('Enter');
    await expect(first.locator('.profiles__switch')).toHaveText([
      'Default', 'Print layout', 'Screen layout',
    ]);

    await first.locator('.profiles__item', { hasText: 'Screen layout' })
      .locator('.profiles__rename').click();
    await first.locator('.profiles__rename-input').fill('Tablet layout');
    await first.locator('.profiles__rename-input').press('Enter');
    await expect(second.locator('.profiles__switch')).toHaveText([
      'Default', 'Print layout', 'Tablet layout',
    ]);

    await second.locator('.profiles__item', { hasText: 'Print layout' })
      .locator('.profiles__rename').click();
    await second.locator('.profiles__rename-input').fill('Paper layout');
    await second.locator('.profiles__rename-input').press('Enter');
    const expectedProfiles = ['Default', 'Paper layout', 'Tablet layout'];
    await expect(first.locator('.profiles__switch')).toHaveText(expectedProfiles);
    await expect(second.locator('.profiles__switch')).toHaveText(expectedProfiles);

    await Promise.all([first.reload(), second.reload()]);
    await expect(first.locator('.profiles__switch')).toHaveText(expectedProfiles);
    await expect(second.locator('.profiles__switch')).toHaveText(expectedProfiles);
  });

  test('profiles keep independent layouts; creating switches to a fresh one', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    // In the Default profile, hide a section.
    await page.locator('.page [data-section-key="senses"] .card__toggle').click();
    await settle(page);
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();

    // Create a new profile — it opens in rename mode; keep the default name.
    await page.locator('.profiles__new').click();
    await page.locator('.profiles__rename-input').press('Escape');
    expect(await page.locator('.profiles__switch').count()).toBe(2);
    await expect(page.locator('.hidden-tray')).toHaveCount(0);
    await expect(page.locator('.page [data-section-key="senses"]')).toHaveCount(1);

    // Switch back to Default — its hidden section is remembered.
    await page.locator('.profiles__switch', { hasText: 'Default' }).click();
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();
  });

  test('deleting a profile (after confirm) removes it and reactivates another', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    await page.locator('.profiles__new').click();
    await page.locator('.profiles__rename-input').press('Escape');
    expect(await page.locator('.profiles__switch').count()).toBe(2);

    // Delete the active (new) profile and confirm the inline prompt.
    await page.locator('.profiles__item--active .profiles__delete').click();
    await page.locator('.profiles__confirm-yes').click();
    await expect(page.locator('.profiles__switch')).toHaveCount(1);
    await expect(page.locator('.profiles__switch', { hasText: 'Default' })).toBeVisible();
  });

  test('canceling the delete confirmation keeps the profile', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    await page.locator('.profiles__new').click();
    await page.locator('.profiles__rename-input').press('Escape');

    await page.locator('.profiles__item--active .profiles__delete').click();
    await expect(page.locator('.profiles__confirm')).toBeVisible();
    await page.locator('.profiles__confirm-no').click();
    await expect(page.locator('.profiles__confirm')).toHaveCount(0);
    expect(await page.locator('.profiles__switch').count()).toBe(2);
  });

  test('the delete button shows for the only profile but is disabled', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    // With a single profile, its delete button is present but disabled.
    await expect(page.locator('.profiles__delete')).toHaveCount(1);
    await expect(page.locator('.profiles__delete')).toBeDisabled();

    // Adding a second profile enables deletion.
    await page.locator('.profiles__new').click();
    await page.locator('.profiles__rename-input').press('Escape');
    await expect(page.locator('.profiles__delete')).toHaveCount(2);
    await expect(page.locator('.profiles__delete').first()).toBeEnabled();
  });

  test('duplicating a profile copies its layout into a new active one', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    // Hide a section in the Default profile.
    await page.locator('.page [data-section-key="senses"] .card__toggle').click();
    await settle(page);
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();

    // Give the async settings write a beat, then duplicate the active profile.
    await page.waitForTimeout(300);
    await page.locator('.profiles__item--active .profiles__dupe').click();

    // A second profile named "Default copy" is now active…
    await expect(page.locator('.profiles__switch')).toHaveCount(2);
    await expect(
      page.locator('.profiles__item--active .profiles__switch', { hasText: 'Default copy' }),
    ).toBeVisible();
    // …and it inherited the hidden section from its source.
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();
  });

  test('renaming a profile updates its label and persists', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    // Rename the Default profile inline via its pencil button.
    await page.locator('.profiles__item--active .profiles__rename').click();
    const input = page.locator('.profiles__rename-input');
    await expect(input).toBeFocused();
    await input.fill('Battle Map');
    await input.press('Enter');
    await expect(page.locator('.profiles__switch', { hasText: 'Battle Map' })).toBeVisible();

    // The new name survives a reload.
    await page.waitForTimeout(300);
    await page.reload();
    await page.locator('[data-section-key="attributes"]').waitFor();
    await expect(page.locator('.profiles__switch', { hasText: 'Battle Map' })).toBeVisible();
  });

  test('names a new profile inline on creation', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    // The New button opens an inline name field focused on the new profile.
    await page.locator('.profiles__new').click();
    const input = page.locator('.profiles__rename-input');
    await expect(input).toBeFocused();
    await input.fill('Screen Layout');
    await input.press('Enter');

    await expect(page.locator('.profiles__switch', { hasText: 'Screen Layout' })).toBeVisible();
  });

  test('reorders profiles by dragging the grip handle', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    // Add a "Second" profile → order is [Default, Second].
    await page.locator('.profiles__new').click();
    const input = page.locator('.profiles__rename-input');
    await input.fill('Second');
    await input.press('Enter');
    expect((await page.locator('.profiles__switch').allInnerTexts()).map((t) => t.trim())).toEqual([
      'Default',
      'Second',
    ]);

    // Drag "Second"'s grip onto the "Default" row → order becomes [Second, Default].
    const secondGrip = page
      .locator('.profiles__item', { hasText: 'Second' })
      .locator('.profiles__grip');
    const defaultRow = page.locator('.profiles__item', { hasText: 'Default' });
    await secondGrip.dragTo(defaultRow);
    expect((await page.locator('.profiles__switch').allInnerTexts()).map((t) => t.trim())).toEqual([
      'Second',
      'Default',
    ]);
  });

  test('profiles persist across a reload', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    await page.locator('.profiles__new').click();
    await page.locator('.profiles__rename-input').press('Escape');
    expect(await page.locator('.profiles__switch').count()).toBe(2);

    // The profile list is saved immediately; give the async write a beat.
    await page.waitForTimeout(300);
    await page.reload();
    await page.locator('[data-section-key="attributes"]').waitFor();

    // Both profiles are still there after the reload.
    expect(await page.locator('.profiles__switch').count()).toBe(2);
  });
});
