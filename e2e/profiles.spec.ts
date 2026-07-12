import { expect, openSheet, test } from './fixtures';
import { settle } from './helpers';

test.describe('layout profiles', () => {
  test('profiles keep independent layouts; creating switches to a fresh one', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    // In the Default profile, hide a section.
    await page.locator('.page [data-section-key="senses"] .card__toggle').click();
    await settle(page);
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();

    // Create a new profile — it starts fresh, so nothing is hidden.
    await page.locator('.profiles__new').click();
    expect(await page.locator('.profiles__switch').count()).toBe(2);
    await expect(page.locator('.hidden-tray')).toHaveCount(0);
    await expect(page.locator('.page [data-section-key="senses"]')).toHaveCount(1);

    // Switch back to Default — its hidden section is remembered.
    await page.locator('.profiles__switch', { hasText: 'Default' }).click();
    await expect(page.locator('.hidden-tray [data-section-key="senses"]')).toBeVisible();
  });

  test('deleting a profile removes it and reactivates another', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    await page.locator('.profiles__new').click();
    expect(await page.locator('.profiles__switch').count()).toBe(2);

    // Delete the active (new) profile via its trash button.
    await page.locator('.profiles__item--active .profiles__delete').click();
    await expect(page.locator('.profiles__switch')).toHaveCount(1);
    await expect(page.locator('.profiles__switch', { hasText: 'Default' })).toBeVisible();
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

  test('profiles persist across a reload', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    await page.locator('.profiles__new').click();
    expect(await page.locator('.profiles__switch').count()).toBe(2);

    // The profile list is saved immediately; give the async write a beat.
    await page.waitForTimeout(300);
    await page.reload();
    await page.locator('[data-section-key="attributes"]').waitFor();

    // Both profiles are still there after the reload.
    expect(await page.locator('.profiles__switch').count()).toBe(2);
  });
});
