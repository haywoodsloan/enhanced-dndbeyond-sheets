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

/** Read the actual clipped content, excluding duplicate DOM retained by continuations. */
export async function visibleSliceItems(
  page: Page,
  cardSelector: string,
  itemSelector: string,
  labelSelector?: string,
): Promise<{ label: string; complete: boolean }[]> {
  return page.locator(cardSelector).evaluateAll((cards, selectors) =>
    cards.flatMap((card) => {
      const body = card.querySelector<HTMLElement>('.card__body');
      if (!body) throw new Error('Card has no body');
      const rect = body.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const clip = getComputedStyle(body).clipPath;
      const topInset = Number(/^inset\(([\d.]+)px/.exec(clip)?.[1] ?? 0);
      const end = /calc\(100% - ([\d.]+)px\)/.exec(clip)?.[1];
      const top = Math.max(cardRect.top, rect.top + topInset);
      const bottom = Math.min(cardRect.bottom, end ? rect.top + Number(end) : rect.bottom);
      return Array.from(body.querySelectorAll<HTMLElement>(selectors.item)).flatMap((item) => {
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom <= top + 0.5 || itemRect.top >= bottom - 0.5) return [];
        const label = selectors.label ? item.querySelector(selectors.label) : item;
        return [{
          label: label?.textContent?.trim() ?? '',
          complete: itemRect.top >= top - 1 && itemRect.bottom <= bottom + 1,
        }];
      });
    }), { item: itemSelector, label: labelSelector });
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
