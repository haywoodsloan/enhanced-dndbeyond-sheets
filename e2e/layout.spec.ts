import { expect, openSheet, test } from './fixtures';
import { cardBox, settle } from './helpers';

test.describe('sheet layout controls', () => {
  test('hiding a section moves it to the tray, and showing it restores it', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    const key = 'senses';

    // It starts on the printable pages, with no hidden tray.
    expect(await page.locator(`.page [data-section-key="${key}"]`).count()).toBe(1);
    expect(await page.locator('.hidden-tray').count()).toBe(0);

    // Hide it via its card toggle.
    await page.locator(`.page [data-section-key="${key}"] .card__toggle`).click();
    await settle(page);

    // It left the pages and now sits in the not-printed tray.
    expect(await page.locator(`.page [data-section-key="${key}"]`).count()).toBe(0);
    await expect(page.locator(`.hidden-tray [data-section-key="${key}"]`)).toBeVisible();

    // Show it again from the tray.
    await page.locator(`.hidden-tray [data-section-key="${key}"] .card__toggle`).click();
    await settle(page);

    // Back on the pages, tray gone.
    expect(await page.locator(`.page [data-section-key="${key}"]`).count()).toBe(1);
    expect(await page.locator('.hidden-tray').count()).toBe(0);
  });

  test('the Reset button restores a hidden section', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);
    const key = 'wealth';

    await page.locator(`.page [data-section-key="${key}"] .card__toggle`).click();
    await settle(page);
    await expect(page.locator(`.hidden-tray [data-section-key="${key}"]`)).toBeVisible();

    await page.locator('.settings__button--reset').click();
    await settle(page);

    // The tray is gone and the section is back on the pages.
    expect(await page.locator('.hidden-tray').count()).toBe(0);
    expect(await page.locator(`.page [data-section-key="${key}"]`).count()).toBe(1);
  });

  test('cycling a card layout resizes it while keeping its top-left', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    const key = 'attributes';
    const before = await cardBox(page, key);

    // Attributes toggles from the 2-column "Wide" layout to the 1-column "Tall".
    await page.locator(`[data-section-key="${key}"] .card__layout`).click();
    await settle(page);

    const after = await cardBox(page, key);
    // Its footprint narrows (2 columns → 1)...
    expect(after.width).toBeLessThan(before.width - 20);
    // ...but its top-left corner is preserved — it doesn't jump to a new column.
    expect(Math.abs(after.x - before.x)).toBeLessThan(12);
  });

  test('changing the page format resizes the sheet', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);
    const pageWidth = () =>
      page
        .locator('.sheet')
        .first()
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--page-width').trim());

    // Letter is the default (215.9mm wide).
    expect(await pageWidth()).toBe('215.9mm');

    // Pick A4 from the Page type dropdown.
    await page
      .locator('.settings__field', { hasText: 'Page type' })
      .locator('.settings__control')
      .click();
    await page.getByRole('option', { name: /A4/ }).click();
    await settle(page);

    // The sheet paper is now A4 (210mm wide).
    expect(await pageWidth()).toBe('210mm');
  });

  test('switching to landscape swaps the sheet dimensions', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);
    const dims = () =>
      page
        .locator('.sheet')
        .first()
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            w: style.getPropertyValue('--page-width').trim(),
            h: style.getPropertyValue('--page-height').trim(),
          };
        });

    // Letter portrait by default.
    expect(await dims()).toEqual({ w: '215.9mm', h: '279.4mm' });

    // Pick Landscape from the Orientation dropdown.
    await page
      .locator('.settings__field', { hasText: 'Orientation' })
      .locator('.settings__control')
      .click();
    await page.getByRole('option', { name: 'Landscape' }).click();
    await settle(page);

    // Width and height are swapped.
    expect(await dims()).toEqual({ w: '279.4mm', h: '215.9mm' });
  });

  test('a hidden section stays hidden across a reload', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);
    const key = 'wealth';

    await page.locator(`.page [data-section-key="${key}"] .card__toggle`).click();
    await settle(page);
    await expect(page.locator(`.hidden-tray [data-section-key="${key}"]`)).toBeVisible();

    // The hidden-sections pref is saved immediately; give the async write a beat.
    await page.waitForTimeout(300);
    await page.reload();
    await page.locator('[data-section-key="attributes"]').waitFor();
    await settle(page);

    // Still hidden after the reload — the preference persisted.
    await expect(page.locator(`.hidden-tray [data-section-key="${key}"]`)).toBeVisible();
    expect(await page.locator(`.page [data-section-key="${key}"]`).count()).toBe(0);
  });
});
