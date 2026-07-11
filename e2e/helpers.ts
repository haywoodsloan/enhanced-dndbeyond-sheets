import type { Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a section card by its key. */
export async function cardBox(page: Page, key: string): Promise<Box> {
  const box = await page.locator(`[data-section-key="${key}"]`).boundingBox();
  if (!box) throw new Error(`card "${key}" has no bounding box`);
  return box;
}

/** A point inside a card's top-left cell. The attributes card spans two columns,
 * so its geometric CENTER falls in the column gap where a 1-column card wouldn't
 * cover it — the top-left quadrant is safely inside a single cell. */
export const topLeftCell = (box: Box) => ({
  x: box.x + box.width * 0.25,
  y: box.y + box.height * 0.25,
});

/** Manhattan distance between two boxes' top-left corners. */
export const moved = (a: Box, b: Box) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Section key of the card under a viewport point, or null for an empty cell. */
export function keyAt(page: Page, x: number, y: number): Promise<string | null> {
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
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
}

/** Grab a card by its drag handle and drop it at a viewport point. */
export async function dragCardTo(
  page: Page,
  key: string,
  to: { x: number; y: number },
): Promise<void> {
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
