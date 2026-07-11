import type { Page } from '@playwright/test';
import { expect, openSheet, test } from './fixtures';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a section card by its key. */
async function cardBox(page: Page, key: string): Promise<Box> {
  const box = await page.locator(`[data-section-key="${key}"]`).boundingBox();
  if (!box) throw new Error(`card "${key}" has no bounding box`);
  return box;
}

/** A point inside a card's top-left cell. The attributes card spans two columns,
 * so its geometric CENTER falls in the column gap where a 1-column card wouldn't
 * cover it — the top-left quadrant is safely inside a single cell. */
const topLeftCell = (box: Box) => ({
  x: box.x + box.width * 0.25,
  y: box.y + box.height * 0.25,
});

/** Manhattan distance between two boxes' top-left corners. */
const moved = (a: Box, b: Box) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Section key of the card under a viewport point, or null for an empty cell. */
function keyAt(page: Page, x: number, y: number): Promise<string | null> {
  return page.evaluate(
    ([px, py]) =>
      document
        .elementFromPoint(px, py)
        ?.closest('[data-section-key]')
        ?.getAttribute('data-section-key') ?? null,
    [x, y] as [number, number],
  );
}

/** Wait for any FLIP glide animations to finish so card positions are final. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
}

/** Grab a card by its drag handle and drop it at a viewport point. */
async function dragCardTo(page: Page, key: string, to: { x: number; y: number }): Promise<void> {
  const handle = await page.locator(`[data-section-key="${key}"] .card__drag-handle`).boundingBox();
  if (!handle) throw new Error(`card "${key}" has no drag handle`);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  // Move in steps so the drag passes its 4px grab threshold and the live reflow
  // runs on the way to the target (mirrors a real cursor drag).
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
  await settle(page);
}

test.describe('card drag placement', () => {
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

  test('a moved card leaves its cell blank without reflowing the others', async ({
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
    expect(await keyAt(page, origin.x, origin.y)).toBe('portrait');

    // Drop the portrait onto the senses card, further down the SAME column.
    await dragCardTo(page, 'portrait', {
      x: sensesStart.x + sensesStart.width / 2,
      y: sensesStart.y + sensesStart.height / 2,
    });

    // The portrait's old cell is now an intentional blank — nothing flowed up to
    // fill it...
    await expect.poll(() => keyAt(page, origin.x, origin.y)).toBeNull();
    // ...and an unrelated card stayed exactly where it was (no global reflow).
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
