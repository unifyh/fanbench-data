import { test, expect } from '@playwright/test';

test('all three results, sorting, filters, language and attribution work', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('?lang=en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('More airflow.Same noise.');
  await expect(page.locator('.fan-row')).toHaveCount(6);
  await expect(page.locator('.fan-row').first().locator('.measurement-cell')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('radiator');
  await expect(page.locator('.fan-row').nth(1)).toContainText('T30 140');
  await expect(page.locator('.fan-row').nth(1)).toContainText('59.56');
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('group', { name: 'Thickness', exact: true }).getByRole('button', { name: '30 mm', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(2);
  await page.getByRole('group', { name: 'Brand', exact: true }).getByRole('button', { name: 'Cooler Master', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await expect(page.locator('.fan-row')).toContainText('MasterFan A140');
  await expect(page.locator('.fan-row').getByRole('link', { name: 'Watch review' })).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1NQti6HErx/');
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page.getByRole('button', { name: '简中', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('同样安静，更多风量。');
  await page.getByRole('searchbox').fill('酷冷至尊');
  await expect(page.locator('.fan-row')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('酷冷至尊');
  await expect(page.locator('.fan-row')).toHaveCount(2);
  await expect(page.locator('.independent-note')).toContainText('无隶属关系');
  expect(errors).toEqual([]);
});

test('shortlist, details, CSV, empty filters and table retain measurements', async ({ page, isMobile }) => {
  await page.goto('?lang=en');
  const fan = page.locator('[data-fan-id="cooler-master-masterfan-a140"]');
  await fan.getByRole('checkbox').check();
  await expect(fan.getByRole('checkbox')).toBeFocused();
  await page.getByRole('checkbox', { name: 'Show selected only' }).check();
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await page.goto(page.url());
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await fan.getByRole('button', { name: 'Fan details: MasterFan A140', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('A140 FC');
  await expect(page.getByRole('dialog')).toContainText('41.95');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(fan.getByRole('button', { name: 'Fan details: MasterFan A140', exact: true })).toBeFocused();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('fan-compare-36dba-ep037.csv');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: '66.96 CFM 1463 RPM' })).toBeVisible();
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('group', { name: 'Size', exact: true }).getByRole('button', { name: '120 mm', exact: true }).click();
  await page.getByRole('group', { name: 'Brand', exact: true }).getByRole('button', { name: 'ARCTIC', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No fans match these filters' })).toBeVisible();
  await page.locator('.empty-state').getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(6);
});

test('layout fits both languages and all chart values are visible without hovering', async ({ page }) => {
  for (const locale of ['en', 'zh-Hans']) {
    await page.goto('?lang=' + locale);
    const layout = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, values: [...document.querySelectorAll('.measurement-values')].map(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.left >= 0 && box.right <= innerWidth; }) }));
    expect(layout.page).toBeLessThanOrEqual(layout.viewport);
    expect(layout.values).toHaveLength(18);
    expect(layout.values.every(Boolean)).toBe(true);
  }
});
