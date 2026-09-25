import { expect, openSheet, test } from './fixtures';
import { settle, visibleSliceItems } from './helpers';

test.beforeEach(async ({ context }) => {
  await context.setOffline(true);
  await context.route(/^https?:\/\//, (route) => route.abort());
});

test('prints every restored lookup row and usable companion statistics', async ({
  context,
  extensionId,
}) => {
  const rows = Array.from({ length: 80 }, (_, index) => [
    String(index + 1), `Outcome ${index + 1}: regain ${index + 1} hit points.`,
  ]);
  const page = await openSheet(context, extensionId, {
    id: 9501, name: 'Rich rules parity', stats: [], classes: [],
    feats: [
      { definition: {
        id: 201, name: 'Fortune Wheel',
        description: '<p>Roll on this table.</p><table><thead><tr><th>Roll</th><th>Effect</th></tr></thead><tbody>' +
          rows.map(([roll, effect]) => `<tr><td>${roll}</td><td>${effect}</td></tr>`).join('') +
          '</tbody></table>',
      } },
      { definition: {
        id: 202, name: 'Construct Bond',
        description: '<div class="stat-block"><h3 class="Stat-Block-Title">Workshop Helper</h3>' +
          '<p><em>Small Construct</em></p><p><strong>Armor Class</strong> 15</p>' +
          '<p><strong>Hit Points</strong> 25</p><p><strong>Speed</strong> 30 ft.</p>' +
          '<p><strong>Actions</strong></p><p><strong>Repair.</strong> Restore 1d6 hit points.</p></div>',
      } },
    ],
  });
  await expect(page.locator('.page [data-section-key="tables"]')).toBeVisible();
  await expect(page.locator('.page [data-section-key="tables~cont~1"]')).toBeVisible();
  const companion = page.locator('.page [data-section-key="companions"]');
  await expect(companion).toContainText('Workshop Helper');
  await expect(companion.locator('.companion__vitals')).toContainText('15');
  await expect(companion).toContainText('Restore 1d6 hit points');
  await settle(page);
  await page.emulateMedia({ media: 'print' });

  const visible = await visibleSliceItems(
    page, '.page [data-section-key^="tables"]', 'tbody [data-rule-row]', 'td:first-child',
  );
  expect(visible.map((item) => item.label)).toEqual(rows.map(([roll]) => roll));
  expect(visible.every((item) => item.complete)).toBe(true);
});

test('keeps pact slots and independent feature grants distinct in both spell views', async ({
  context,
  extensionId,
}) => {
  const page = await openSheet(context, extensionId, {
    id: 9502, name: 'Pact and grants parity',
    stats: [{ id: 6, value: 16 }],
    classes: [{
      level: 5,
      definition: {
        name: 'Warlock', spellCastingAbilityId: 6,
        spellRules: {
          multiClassSpellSlotDivisor: 1,
          levelSpellSlots: [[], [1], [2], [0, 2], [0, 2], [0, 0, 2]],
        },
      },
    }],
    feats: [
      { definition: { id: 101, name: 'Dawn Gift' } },
      { definition: { id: 102, name: 'Night Gift' } },
    ],
    spells: { feat: [
      {
        componentId: 101, componentTypeId: 1088085227,
        definition: { id: 501, name: 'Shared Ward', level: 1 },
        limitedUse: { maxUses: 1, resetType: 1 },
      },
      {
        componentId: 102, componentTypeId: 1088085227,
        definition: { id: 501, name: 'Shared Ward', level: 1 },
        limitedUse: { maxUses: 2, resetType: 2 },
      },
    ] },
  });
  const spells = page.locator('.page [data-section-key="spells"]');
  await expect(spells.locator('[data-pact-slots] .resource__box')).toHaveCount(2);
  await expect(spells.locator('[data-pact-slots]')).toContainText(/short rest/i);
  await expect(spells.locator('[data-spell-uses]')).toHaveCount(2);
  await expect(spells.locator('[data-spell-uses]')).toContainText(['Dawn Gift', 'Night Gift']);
  await expect(spells.locator('[data-spell-uses] .resource__box')).toHaveCount(3);
  await spells.locator('.card__spell-toggle').click();
  const expanded = page.locator('.page [data-section-key="spell:shared-ward"]');
  await expect(expanded.locator('[data-spell-uses]')).toHaveCount(2);
  await expect(expanded.locator('[data-spell-uses] .resource__box')).toHaveCount(3);
  await expect(spells.locator('[data-pact-slots] .resource__box')).toHaveCount(2);
  await expect(spells.locator('[data-spell]')).toHaveCount(0);
});

test('retains Artificer focus and regular/pact slots beside expanded spells', async ({
  context,
  extensionId,
}) => {
  const page = await openSheet(context, extensionId, {
    id: 9503, name: 'Expanded casting summary',
    stats: [{ id: 4, value: 14 }, { id: 6, value: 16 }],
    classes: [
      { id: 1, level: 3, definition: {
        name: 'Artificer', spellCastingAbilityId: 4,
        spellRules: { multiClassSpellSlotDivisor: 2, levelSpellSlots: [[], [2], [2], [3]] },
        classFeatures: [{
          id: 10, name: 'Spellcasting',
          description: '<p><strong><em>Tools Required.</em></strong> Tools are required for every spell.</p>',
        }],
      } },
      { id: 2, level: 5, definition: {
        name: 'Warlock', spellCastingAbilityId: 6,
        spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: [[], [1], [2], [0, 2], [0, 2], [0, 0, 2]] },
      } },
    ],
    spells: { class: [{ spellCastingAbilityId: 4, definition: {
      id: 501, name: 'Test Barrier', level: 1, description: '<p>A test protection effect.</p>',
    } }] },
  });
  const summary = page.locator('.page [data-section-key="spells"]');
  const spell = page.locator('.page [data-section-key="spell:test-barrier"]');
  await expect(summary).toContainText('Tools are required for every spell.');
  await expect(summary.locator('[data-slots] .resource__box')).toHaveCount(3);
  await expect(summary.locator('[data-pact-slots] .resource__box')).toHaveCount(2);
  await summary.getByRole('button', { name: 'Show spell cards' }).click();
  await expect(spell).toBeVisible();
  await expect(summary).toContainText('Tools are required for every spell.');
  await expect(summary.locator('[data-slots] .resource__box')).toHaveCount(3);
  await expect(summary.locator('[data-pact-slots] .resource__box')).toHaveCount(2);
  await expect(summary.locator('[data-spell]')).toHaveCount(0);
  await settle(page);
  await page.emulateMedia({ media: 'print' });
  await expect(summary.locator('[data-spellcasting-profile]').first()).toBeVisible();
  await expect(summary.locator('[data-pact-slots]')).toBeVisible();
  const printedParts = await visibleSliceItems(
    page, '.page [data-section-key^="spells"]', '[data-spellcasting-profile],[data-spell-level]',
  );
  expect(printedParts).toHaveLength(4);
  expect(printedParts.every((part) => part.complete)).toBe(true);
  expect(printedParts.some((part) => part.label.includes('Tools are required for every spell.'))).toBe(true);
  await page.emulateMedia({ media: 'screen' });
  await summary.getByRole('button', { name: 'Back to spell list' }).click();
  await expect(spell).toHaveCount(0);
  await expect(summary.locator('[data-spell]')).toHaveCount(1);
  await summary.getByRole('button', { name: 'Show spell cards' }).click();
  await expect(spell).toBeVisible();
  await spell.getByRole('button', { name: 'Back to spell list' }).click();
  await expect(spell).toHaveCount(0);
  await expect(summary.locator('[data-spell]')).toHaveCount(1);
});
