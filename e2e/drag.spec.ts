import { expect, openSheet, test } from './fixtures';
import { cardBox, dragCardTo, keyAt, moved, settle, topLeftCell } from './helpers';

test.describe('card drag placement', () => {
  test('moves a focused card with the keyboard', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);
    const start = await cardBox(page, 'portrait');
    const handle = page.locator('[data-section-key="portrait"] .card__drag-handle');

    await handle.focus();
    await expect(handle).toBeFocused();
    await expect(handle).toHaveAttribute('aria-label', /use arrow keys/i);
    await handle.press('ArrowDown');

    await expect.poll(async () => moved(await cardBox(page, 'portrait'), start)).toBeGreaterThan(8);
  });

  test('dragging a card onto another pushes the other out of the way', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    const portraitStart = await cardBox(page, 'portrait');
    const attributesStart = await cardBox(page, 'attributes');
    const drop = topLeftCell(attributesStart);

    // The drop target is the attributes card before the drag.
    expect(await keyAt(page, drop.x, drop.y)).toBe('attributes');

    await dragCardTo(page, 'portrait', drop);

    // After the drag the portrait occupies that cell — it won its target...
    await expect.poll(() => keyAt(page, drop.x, drop.y)).toBe('portrait');
    // ...and both the portrait and the displaced attributes card have moved.
    expect(moved(await cardBox(page, 'portrait'), portraitStart)).toBeGreaterThan(8);
    expect(moved(await cardBox(page, 'attributes'), attributesStart)).toBeGreaterThan(8);
  });

  test('flows the other cards out of the way DURING the drag, before release', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    const attributesStart = await cardBox(page, 'attributes');
    const handle = await page
      .locator('[data-section-key="portrait"] .card__drag-handle')
      .boundingBox();
    if (!handle) throw new Error('portrait has no drag handle');

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    const target = topLeftCell(attributesStart);
    await page.mouse.move(target.x, target.y, { steps: 40 });

    // Button is still held down: the displaced card has already flowed aside.
    expect(moved(await cardBox(page, 'attributes'), attributesStart)).toBeGreaterThan(8);

    await page.mouse.up();
  });

  test('a displaced card takes the short way into the vacated cell, not a global reflow', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);

    const portraitStart = await cardBox(page, 'portrait');
    const attributesStart = await cardBox(page, 'attributes');
    const sensesStart = await cardBox(page, 'senses');
    // A point in the middle of the portrait's own (single-column) cell.
    const origin = {
      x: portraitStart.x + portraitStart.width / 2,
      y: portraitStart.y + portraitStart.height / 2,
    };
    const sensesCell = {
      x: sensesStart.x + sensesStart.width / 2,
      y: sensesStart.y + sensesStart.height / 2,
    };
    expect(await keyAt(page, origin.x, origin.y)).toBe('portrait');

    // Drop the portrait onto the senses card, further down the SAME column.
    await dragCardTo(page, 'portrait', sensesCell);

    // Senses flowed the SHORT way out of the way — up into the cell the portrait
    // just vacated (a nearby backward move), so its old cell now holds senses
    // rather than wrapping far forward or leaving a blank.
    await expect.poll(() => keyAt(page, origin.x, origin.y)).toBe('senses');
    // The portrait really did move down onto the senses area (the drop landed).
    expect(moved(await cardBox(page, 'portrait'), portraitStart)).toBeGreaterThan(8);
    // The drop stays local: an unrelated card did not move (no cascade).
    expect(moved(await cardBox(page, 'attributes'), attributesStart)).toBeLessThan(2);
  });

  test('a placement persists across a reload', async ({ context, extensionId }) => {
    const page = await openSheet(context, extensionId);

    const drop = topLeftCell(await cardBox(page, 'attributes'));
    await dragCardTo(page, 'portrait', drop);
    await expect.poll(() => keyAt(page, drop.x, drop.y)).toBe('portrait');

    // Let the debounced placement save flush (500ms) before reloading.
    await page.waitForTimeout(700);
    await page.reload();
    await page.locator('[data-section-key="attributes"]').waitFor();
    await settle(page);

    // The portrait is still where it was dropped, not back at its default cell.
    await expect.poll(() => keyAt(page, drop.x, drop.y)).toBe('portrait');
  });
});
