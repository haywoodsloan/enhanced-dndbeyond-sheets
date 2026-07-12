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
    const columnCount = () =>
      page
        .locator('.page__grid')
        .first()
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

    // Letter portrait by default: 3-column grid.
    expect(await dims()).toEqual({ w: '215.9mm', h: '279.4mm' });
    expect(await columnCount()).toBe(3);

    // Pick Landscape from the Orientation dropdown.
    await page
      .locator('.settings__field', { hasText: 'Orientation' })
      .locator('.settings__control')
      .click();
    await page.getByRole('option', { name: 'Landscape' }).click();
    await settle(page);

    // Width and height are swapped, and the grid transposes to 4 columns.
    expect(await dims()).toEqual({ w: '279.4mm', h: '215.9mm' });
    expect(await columnCount()).toBe(4);
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

  test('expands spells into individual cards and collapses back', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    // Starts as one quick-sheet spells card with an expand control.
    expect(await page.locator('.page [data-section-key="spells"]').count()).toBe(1);
    expect(await page.locator('.page [data-section-key^="spell:"]').count()).toBe(0);

    await page.locator('.page [data-section-key="spells"] .card__spell-toggle').click();
    await settle(page);

    // Each spell is now its own card; the single spells card is gone.
    expect(await page.locator('.page [data-section-key="spells"]').count()).toBe(0);
    expect(
      await page.locator('.page [data-section-key^="spell:"]').count(),
    ).toBeGreaterThan(1);

    // A spell card's collapse control returns to the quick sheet.
    await page
      .locator('.page [data-section-key^="spell:"] .card__spell-toggle')
      .first()
      .click();
    await settle(page);
    expect(await page.locator('.page [data-section-key="spells"]').count()).toBe(1);
    expect(await page.locator('.page [data-section-key^="spell:"]').count()).toBe(0);
  });

  test('the spells card grows to fit its full list without clipping', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    await settle(page);

    // The reported bug: the spells card didn't grow to include the whole list and
    // clipped the bottom. It should now be tall enough to show every spell.
    const base = page.locator('.page [data-section-key="spells"]');
    const cardBox = await base.boundingBox();
    const bodyBox = await base.locator('.card__body').boundingBox();
    // The card is at least as tall as its content — nothing is cut off.
    expect(cardBox!.height).toBeGreaterThanOrEqual(bodyBox!.height);
    // And the last spell row sits within the card's visible bounds.
    const lastSpell = base.locator('[data-spell]').last();
    const spellBox = await lastSpell.boundingBox();
    expect(spellBox!.y + spellBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 2);
  });

  test('an over-tall card continues on a follow-up card', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    // Compress the layout to A5 so the Features list is taller than one page.
    await page
      .locator('.settings__field', { hasText: 'Page type' })
      .locator('.settings__control')
      .click();
    await page.getByRole('option', { name: /A5/ }).click();
    await settle(page);
    await page.waitForTimeout(300);

    // The base Features card stays, and the overflow spills onto a continuation
    // card titled "… (cont.)".
    const base = page.locator('.page [data-section-key="features"]').first();
    await expect(base).toBeVisible();
    const cont = page.locator('.page [data-section-key="features~cont~1"]');
    await expect(cont).toBeVisible();
    await expect(cont).toContainText('(cont.)');

    // Every narrower layout would overflow even more, so the layout toggle is
    // disabled — overflow is the last resort, not a reason to shrink the card.
    await expect(base.locator('.card__layout')).toBeDisabled();

    // The continuation reveals a LATER slice of the same body (translated up),
    // while the base shows the top (no transform).
    const baseTransform = await base
      .locator('.card__body')
      .evaluate((el) => getComputedStyle(el).transform);
    const contTransform = await cont
      .locator('.card__body')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(baseTransform);
    expect(contTransform).not.toBe('none');

    // The base card is capped at one printable page (it grew to fit, not beyond),
    // so nothing is clipped off the bottom of an over-tall single card.
    const gridBox = await page.locator('.page__grid').first().boundingBox();
    const baseBox = await base.boundingBox();
    expect(baseBox!.height).toBeLessThanOrEqual(gridBox!.height + 3);

    // Continuations are display-only: no drag handle or hide/layout controls.
    expect(await cont.locator('.card__drag-handle').count()).toBe(0);
    expect(await cont.locator('.card__toggle').count()).toBe(0);
  });
});
