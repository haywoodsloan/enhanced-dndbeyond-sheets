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

  test('keeps the Basics HP line and conditions inside the card', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    const basics = page.locator('.page [data-section-key="basics"]');
    const tiles = basics.locator('.basics__stat');
    await expect(tiles).toHaveCount(5);
    await expect(basics.locator('.card__title-sep')).toHaveCount(2);
    await expect(basics.locator('.card__meta')).toHaveText('Medium · Humanoid');

    const result = await basics.evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const stats = Array.from(card.querySelectorAll<HTMLElement>('.basics__stat'));
      const hpBlank = card.querySelector<HTMLElement>('.basics__blank')?.getBoundingClientRect();
      const tempBlank = card
        .querySelector<HTMLElement>('.basics__temp-blank')
        ?.getBoundingClientRect();
      const conditions = Array.from(card.querySelectorAll<HTMLElement>('.conditions__item'));
      const heading = card.querySelector<HTMLElement>('.card__heading');
      return {
        contained: stats.every((stat) => {
          const rect = stat.getBoundingClientRect();
          return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
        }),
        overflow: stats.some((stat) => stat.scrollWidth > stat.clientWidth + 1),
        hpOnOneLine:
          hpBlank != null && tempBlank != null && Math.abs(hpBlank.top - tempBlank.top) < 3,
        conditionsContained: conditions.every(
          (condition) => condition.getBoundingClientRect().bottom <= cardRect.bottom + 1,
        ),
        titleSingleLine: heading != null && heading.getBoundingClientRect().height < 24,
      };
    });
    expect(result.contained).toBe(true);
    expect(result.overflow).toBe(false);
    expect(result.hpOnOneLine).toBe(true);
    expect(result.conditionsContained).toBe(true);
    expect(result.titleSingleLine).toBe(true);
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

  test('grows an expanded spell tile when late content wraps', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    await page.locator('.page [data-section-key="spells"] .card__spell-toggle').click();
    await settle(page);

    const candidate = page
      .locator('.page [data-section-key^="spell:"]', {
        has: page.locator('.spell-card__summary'),
      })
      .first();
    const key = await candidate.getAttribute('data-section-key');
    expect(key).toBeTruthy();
    const before = await candidate.boundingBox();
    expect(before).toBeTruthy();
    if (!key || !before) throw new Error('Expanded spell card did not render');

    await candidate.locator('.spell-card__summary').evaluate((element) => {
      element.textContent = 'UnbrokenRuleToken'.repeat(100);
    });
    await page.waitForFunction(
      ({ sectionKey, previousHeight }: { sectionKey: string; previousHeight: number }) => {
        const card = document.querySelector<HTMLElement>(
          `[data-section-key="${sectionKey}"]`,
        );
        return card != null && card.getBoundingClientRect().height > previousHeight + 20;
      },
      { sectionKey: key, previousHeight: before.height },
    );
    await settle(page);

    const result = await page
      .locator(`[data-section-key="${key}"]`)
      .evaluate((card) => {
        const body = card.querySelector<HTMLElement>('.card__body');
        if (!body) return { fits: false, horizontalOverflow: true };
        const cardRect = card.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        return {
          fits: bodyRect.bottom <= cardRect.bottom + 1,
          horizontalOverflow: body.scrollWidth > body.clientWidth + 1,
        };
      });
    expect(result.fits).toBe(true);
    expect(result.horizontalOverflow).toBe(false);
  });

  test('the spells card grows to a page then continues so nothing is clipped', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    await settle(page);

    // The reported bug was the spells card clipping its list at a small estimate.
    // With the full per-spell blurbs the list is taller than a page, so the card
    // grows to a full page and continues onto a follow-up card — every spell is
    // shown, none clipped.
    const base = page.locator('.page [data-section-key="spells"]');
    await expect(base).toBeVisible();
    const gridBox = await page.locator('.page__grid').first().boundingBox();
    const baseBox = await base.boundingBox();
    // The card grew but is capped at one printable page (not unbounded).
    expect(baseBox!.height).toBeLessThanOrEqual(gridBox!.height + 2);
    // The remainder of the list continues on a "(cont.)" card.
    const continuation = page.locator('.page [data-section-key="spells~cont~1"]');
    await expect(continuation).toBeVisible();

    for (const [index, card] of [base, continuation].entries()) {
      const legend = card.locator('.card__title > .card__spell-legend');
      await expect(legend).toBeVisible();
      await expect(legend.locator('.card__spell-legend-tag')).toHaveText(['C', 'R']);
      await expect(legend.locator('.card__spell-legend-item > span')).toHaveText([
        'Concentration',
        'Ritual',
      ]);
      const placement = await card.evaluate((element) => {
        const legend = element.querySelector<HTMLElement>('.card__spell-legend');
        const title = element.querySelector<HTMLElement>('.card__title');
        if (!legend || !title) return { inTitle: false, oneRow: false, rightGap: Infinity };
        const legendRect = legend.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        return {
          inTitle: legend.parentElement === title,
          oneRow: titleRect.height < 24,
          rightGap: titleRect.right - legendRect.right,
        };
      });
      expect(placement.inTitle).toBe(true);
      expect(placement.oneRow).toBe(true);
      expect(placement.rightGap).toBeGreaterThanOrEqual(-1);
      expect(placement.rightGap).toBeLessThan(index === 0 ? 78 : 2);
    }
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

    const boundary = await cont.locator('.card__body').evaluate((body) => {
      const bodyRect = body.getBoundingClientRect();
      const clipPath = getComputedStyle(body).clipPath;
      const topInset = Number.parseFloat(/inset\(([\d.]+)px/.exec(clipPath)?.[1] ?? '0');
      const visibleTop = bodyRect.top + topInset;
      const groupBottoms = Array.from(body.querySelectorAll<HTMLElement>('[data-card-group]'))
        .map((group) => group.getBoundingClientRect().bottom);
      return {
        clipPath,
        dividerAtTop: groupBottoms.some(
          (bottom) => bottom >= visibleTop - 1 && bottom <= visibleTop + 2,
        ),
      };
    });
    expect(boundary.clipPath).not.toBe('none');
    expect(boundary.dividerAtTop).toBe(false);

    // The base card is capped at one printable page (it grew to fit, not beyond),
    // so nothing is clipped off the bottom of an over-tall single card.
    const gridBox = await page.locator('.page__grid').first().boundingBox();
    const baseBox = await base.boundingBox();
    expect(baseBox!.height).toBeLessThanOrEqual(gridBox!.height + 3);

    // Continuations are display-only: no drag handle or hide/layout controls.
    expect(await cont.locator('.card__drag-handle').count()).toBe(0);
    expect(await cont.locator('.card__toggle').count()).toBe(0);
  });

  test('prints exact page containers with configured margins', async ({
    context,
    extensionId,
  }) => {
    const page = await openSheet(context, extensionId);
    await settle(page);
    await page.emulateMedia({ media: 'print' });

    const geometry = await page.locator('.page').evaluateAll((pages) =>
      pages.map((paper) => {
        const pageRect = paper.getBoundingClientRect();
        const grid = paper.querySelector<HTMLElement>('.page__grid');
        if (!grid) throw new Error('Printed page has no grid');
        const gridRect = grid.getBoundingClientRect();
        const style = getComputedStyle(paper);
        const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-section-key]'));
        return {
          top: pageRect.top,
          bottom: pageRect.bottom,
          width: pageRect.width,
          height: pageRect.height,
          padding: {
            top: Number.parseFloat(style.paddingTop),
            right: Number.parseFloat(style.paddingRight),
            bottom: Number.parseFloat(style.paddingBottom),
            left: Number.parseFloat(style.paddingLeft),
          },
          inset: {
            top: gridRect.top - pageRect.top,
            right: pageRect.right - gridRect.right,
            bottom: pageRect.bottom - gridRect.bottom,
            left: gridRect.left - pageRect.left,
          },
          cardsContained: cards.every((card) => {
            const rect = card.getBoundingClientRect();
            return (
              rect.top >= gridRect.top - 1 &&
              rect.left >= gridRect.left - 1 &&
              rect.right <= gridRect.right + 1 &&
              rect.bottom <= gridRect.bottom + 1
            );
          }),
        };
      }),
    );

    expect(geometry.length).toBeGreaterThan(1);
    for (const paper of geometry) {
      expect(paper.inset.top).toBeCloseTo(paper.padding.top, 1);
      expect(paper.inset.right).toBeCloseTo(paper.padding.right, 1);
      expect(paper.inset.bottom).toBeCloseTo(paper.padding.bottom, 1);
      expect(paper.inset.left).toBeCloseTo(paper.padding.left, 1);
      expect(paper.cardsContained).toBe(true);
    }
    for (let index = 1; index < geometry.length; index += 1) {
      expect(geometry[index].top).toBeCloseTo(geometry[index - 1].bottom, 1);
    }

    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const source = pdf.toString('latin1');
    const pdfPages = source.match(/\/Type\s*\/Page\b/g) ?? [];
    expect(pdfPages).toHaveLength(geometry.length);
    const mediaBox = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(source);
    expect(mediaBox).toBeTruthy();
    expect(Number(mediaBox?.[1])).toBeCloseTo(612, 0);
    expect(Number(mediaBox?.[2])).toBeCloseTo(792, 0);
  });
});
