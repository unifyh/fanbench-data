import { test, expect } from '@playwright/test';

test('all three results, sorting, filters, language and attribution work', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('?lang=en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('FanBench Data Archive');
  await expect(page.locator('.fan-row')).toHaveCount(40);
  await expect(page.locator('.fan-row').first().locator('.measurement-cell')).toHaveCount(3);
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('radiator');
  } else {
    await expect(page.locator('.toolbar-right')).toBeHidden();
    await page.getByRole('button', { name: 'Sort by: Radiator', exact: true }).click();
  }
  await expect(page.locator('.fan-row').first()).toContainText('LP14E');
  await expect(page.locator('.fan-row').nth(2)).toContainText('T30 140');
  await expect(page.locator('.fan-row').nth(2)).toContainText('59.56');
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  else await page.getByRole('button', { name: 'Thickness All', exact: true }).click();
  await page.getByRole('group', { name: 'Thickness', exact: true }).getByRole('button', { name: '30 mm', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(10);
  await expect(page.locator('[data-fan-id="sudkoo-mach140"] .form-factor')).toHaveText('140 × 30 mm');
  await expect(page.locator('[data-fan-id="cooler-master-masterfan-a120"] .form-factor')).toHaveText('120 × 30 mm');
  if (!isMobile) await page.getByRole('button', { name: 'Brand All', exact: true }).click();
  await page.getByRole('group', { name: 'Brand', exact: true }).getByRole('button', { name: 'Cooler Master', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(3);
  if (!isMobile) await page.getByRole('button', { name: 'Size 120 mm, 140 mm', exact: true }).click();
  await page.getByRole('group', { name: 'Size', exact: true }).getByRole('button', { name: '120 mm', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await expect(page.locator('.fan-row')).toContainText('MasterFan A140');
  await expect(page.locator('.fan-row').getByRole('link', { name: 'Watch review' })).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1NQti6HErx/');
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page.getByRole('button', { name: '简中', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('风向标测试数据汇总');
  await page.getByRole('searchbox').fill('酷冷至尊');
  await expect(page.locator('.fan-row')).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('酷冷至尊');
  await expect(page.locator('.fan-row')).toHaveCount(6);
  await expect(page.locator('.independent-note')).toContainText('无隶属关系');
  expect(errors).toEqual([]);
});

test('localized product names work across search, selection, details and exports', async ({ page, isMobile }) => {
  await page.goto('?lang=en');
  await page.getByRole('searchbox').fill('大镰刀 温柔台风 GT-3000 PWM');
  await expect(page.locator('.fan-row')).toHaveCount(1);
  const fan = page.locator('[data-fan-id="scythe-gentle-typhoon-gt-3000-pwm"]');
  await expect(fan.locator('.model-button')).toHaveText('Gentle Typhoon GT-3000 PWM');
  await fan.getByRole('checkbox', { name: 'Select Gentle Typhoon GT-3000 PWM', exact: true }).check();
  await page.getByRole('button', { name: '简中', exact: true }).click();
  await expect(fan).toHaveAccessibleName('大镰刀 温柔台风 GT-3000 PWM');
  await expect(fan.locator('.brand-name')).toHaveText('大镰刀');
  await expect(fan.locator('.model-button')).toHaveText('温柔台风 GT-3000 PWM');
  await expect(fan.getByRole('checkbox', { name: '选择 温柔台风 GT-3000 PWM', exact: true })).toBeChecked();
  await fan.getByRole('button', { name: '风扇详情: 温柔台风 GT-3000 PWM', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText('温柔台风 GT-3000 PWM');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('searchbox').fill('Scythe Gentle Typhoon GT-3000 PWM');
  await expect(page.locator('.fan-row')).toHaveCount(1);
  if (isMobile) {
    await page.getByRole('button', { name: '表格', exact: true }).click();
    await expect(page.getByRole('table').locator('.model-button')).toHaveText('温柔台风 GT-3000 PWM');
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 CSV', exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('"大镰刀","温柔台风 GT-3000 PWM"');
  expect(csv).toContain('"47.07","1955"');
  await page.getByRole('searchbox').fill('RYVNTEC R25 LCP PRO');
  await expect(page.locator('.model-button')).toHaveText('R25 LCP PRO');
  await expect(page.locator('.fan-identity .brand-name')).toHaveText('睿温');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.model-button')).toHaveText('R25 LCP PRO');
  await expect(page.locator('.fan-identity .brand-name')).toHaveText('RYVNTEC');
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
  await expect(page.getByRole('dialog').locator('.form-factor')).toHaveText('140 × 30 mm');
  await expect(page.getByRole('dialog')).toContainText('41.95');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(fan.getByRole('button', { name: 'Fan details: MasterFan A140', exact: true })).toBeFocused();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('fanbench-data-36dba.csv');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  if (isMobile) {
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: '66.96 CFM 1463 RPM' })).toBeVisible();
    await page.getByRole('button', { name: 'Chart', exact: true }).click();
  } else {
    await page.goto('?lang=en&view=table');
    await expect(page.locator('.chart-view')).toBeVisible();
    await page.getByRole('button', { name: 'Sort by: Case', exact: true }).click();
    await expect(page.locator('.fan-row').first()).toContainText('NF-A12x15 PWM');
    await expect(page.getByRole('button', { name: 'Sort by: Case', exact: true })).toBeFocused();
  }
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  else await page.getByRole('button', { name: 'Size 120 mm, 140 mm', exact: true }).click();
  await page.getByRole('group', { name: 'Size', exact: true }).getByRole('button', { name: '140 mm', exact: true }).click();
  if (!isMobile) await page.getByRole('button', { name: 'Brand All', exact: true }).click();
  await page.getByRole('group', { name: 'Brand', exact: true }).getByRole('button', { name: 'HAVN', exact: true }).click();
  if (!isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Brand HAVN', exact: true })).toBeFocused();
  }
  await expect(page.getByRole('heading', { name: 'No fans match these filters' })).toBeVisible();
  await page.locator('.empty-state').getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(40);
});

test('case-only fans retain missing cells in sorting, details, table and CSV', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('?lang=en&size=all');
  const havn = page.locator('[data-fan-id="havn-h18-performance"]');
  await expect(page.locator('.fan-row').first()).toHaveAttribute('data-fan-id', 'havn-h18-performance');
  await expect(page.locator('.fan-row .no-data')).toHaveCount(16);
  for (const application of ['heatsink', 'radiator']) {
    for (const order of ['desc', 'asc']) {
      await page.goto(`?lang=en&size=all&sort=${application}&order=${order}`);
      const missing = await page.locator('.fan-row').evaluateAll((rows, key) => rows.map(row => Boolean(row.querySelector(`.${key} .no-data`))), application);
      expect(missing).toEqual([...Array(39).fill(false), ...Array(8).fill(true)]);
    }
  }
  await havn.getByRole('checkbox', { name: 'Select H18 Performance', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Show selected only' }).check();
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await expect(havn.locator('.measurement-cell')).toHaveCount(3);
  await expect(havn.locator('.bar')).toHaveCount(1);
  await expect(havn.locator('.case .airflow-value')).toHaveText('105.39');
  await expect(havn.locator('.case .rpm')).toHaveText('931 RPM');
  await expect(havn.locator('.no-data')).toHaveCount(2);
  await expect(havn.locator('.no-data').first()).toHaveAttribute('title', 'No data');
  await expect(havn.locator('.form-factor')).toHaveText('180 × 40 mm');
  await expect(havn.getByRole('link', { name: 'Watch review' })).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1Cv2VBfE6p/');
  const aligned = await havn.locator('.no-data').evaluateAll(elements => elements.every(element => {
    const dash = element.getBoundingClientRect();
    const cell = element.closest('.measurement-cell')!.getBoundingClientRect();
    return dash.width > 0 && dash.left >= cell.left && dash.right <= cell.right && dash.top >= cell.top && dash.bottom <= cell.bottom;
  }));
  expect(aligned).toBe(true);
  await havn.getByRole('button', { name: 'Fan details: H18 Performance', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.no-data')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toContainText('105.39 CFM');
  await expect(page.getByRole('dialog')).not.toContainText('0.00');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: '简中', exact: true }).click();
  await expect(havn.locator('.no-data').first()).toHaveAttribute('title', '暂无数据');
  if (isMobile) {
    await page.getByRole('button', { name: '表格', exact: true }).click();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('table').locator('.no-data')).toHaveCount(2);
    await expect(page.getByRole('table').getByRole('cell', { name: '105.39 CFM 931 RPM' })).toBeVisible();
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 CSV', exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('"HAVN","H18 Performance","180","40","36","30","105.39","931","","","",""');
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('layout fits both languages and all chart values are visible without hovering', async ({ page }) => {
  for (const locale of ['en', 'zh-Hans']) {
    await page.goto('?size=all&lang=' + locale);
    const layout = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth, viewport: innerWidth,
      values: [...document.querySelectorAll('.airflow-value, .rpm')].map(element => {
        const box = element.getBoundingClientRect();
        const cell = element.closest('.measurement-cell')!.getBoundingClientRect();
        return box.width > 0 && box.left >= cell.left && box.right <= cell.right && box.top >= cell.top && box.bottom <= cell.bottom && box.right <= innerWidth;
      }),
    }));
    expect(layout.page).toBeLessThanOrEqual(layout.viewport);
    expect(layout.values).toHaveLength(250);
    expect(layout.values.every(Boolean)).toBe(true);
  }
});

test('desktop filter options stay inside their dropdowns in both languages', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile filters are inline rather than dropdowns.');
  for (const width of [1440, 1024, 800, 650]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['en', 'zh-Hans']) {
      await page.goto('?lang=' + locale);
      for (const trigger of await page.locator('.filter-trigger').all()) {
        await trigger.click();
        const panel = page.locator('.filter-field fieldset');
        await expect(panel).toBeVisible();
        const layout = await panel.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const legend = element.querySelector('legend')!.getBoundingClientRect();
          return {
            insideViewport: bounds.left >= 0 && bounds.right <= innerWidth,
            containedOptions: [...element.querySelectorAll('button')].every(button => {
              const option = button.getBoundingClientRect();
              return option.width > 0 && option.left >= bounds.left && option.right <= bounds.right
                && option.top >= legend.bottom && option.bottom <= bounds.bottom;
            }),
          };
        });
        expect(layout).toEqual({ insideViewport: true, containedOptions: true });
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      }
    }
  }
});

test('size defaults, All, explicit sizes and reset survive reloads', async ({ page, isMobile }) => {
  await page.goto('?lang=en');
  await expect(page.locator('.fan-row')).toHaveCount(40);
  await expect(page.locator('.scale-note')).toContainText('0–80 CFM');
  await expect(page.locator('.results-count').getByRole('button', { name: 'Reset filters', exact: true })).toHaveCount(0);
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  else await page.getByRole('button', { name: 'Size 120 mm, 140 mm', exact: true }).click();
  const size = page.getByRole('group', { name: 'Size', exact: true });
  await expect(size.getByRole('button', { name: '120 mm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(size.getByRole('button', { name: '140 mm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(size.getByRole('button', { name: '180 mm', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await size.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(47);
  await expect(page.locator('.scale-note')).toContainText('0–150 CFM');
  expect(new URL(page.url()).searchParams.get('size')).toBe('all');
  await page.reload();
  await expect(page.locator('.fan-row')).toHaveCount(47);
  await expect(page.locator('.scale-note')).toContainText('0–150 CFM');
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
  else await page.getByRole('button', { name: 'Size All', exact: true }).click();
  await size.getByRole('button', { name: '180 mm', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('size')).toBe('180');
  await page.reload();
  await expect(page.locator('.fan-row')).toHaveCount(2);
  await expect(page.locator('[data-fan-id="havn-h18-performance"]')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.fan-row')).toHaveCount(40);
  await expect(page.locator('.scale-note')).toContainText('0–80 CFM');
  expect(new URL(page.url()).searchParams.get('size')).toBe('120,140');
  await page.reload();
  await expect(page.locator('.fan-row')).toHaveCount(40);
});

test('filtering resizes the shared scale and sorting preserves bar lengths', async ({ page, isMobile }) => {
  await page.goto('?lang=en&size=all');
  const fan = page.locator('[data-fan-id="cooler-master-masterfan-a140"]');
  const widths = () => fan.locator('.bar').evaluateAll(bars => bars.map(bar => bar.getBoundingClientRect().width));
  const axes = page.locator(isMobile ? '.mobile-axis .axis-labels' : '.chart-heading .axis-labels');
  await expect(page.locator('.scale-note')).toContainText('0–150 CFM');
  const initial = await widths();
  await page.getByRole('searchbox').fill('A140');
  await expect(page.locator('.fan-row')).toHaveCount(1);
  await expect(page.locator('.scale-note')).toContainText('0–80 CFM');
  const filtered = await widths();
  for (const [index, width] of filtered.entries()) expect(width / initial[index]).toBeCloseTo(150 / 80, 2);
  expect(await axes.allTextContents()).toEqual(Array(isMobile ? 1 : 3).fill('020406080'));
  if (isMobile) await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('radiator');
  else await page.getByRole('button', { name: 'Sort by: Radiator', exact: true }).click();
  expect(await widths()).toEqual(filtered);
  await page.getByRole('searchbox').fill('R25');
  await expect(page.locator('.scale-note')).toContainText('0–60 CFM');
  expect(await axes.allTextContents()).toEqual(Array(isMobile ? 1 : 3).fill('0204060'));
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('.scale-note')).toContainText('0–150 CFM');
  expect(await widths()).toEqual(initial);
  await fan.getByRole('checkbox').check();
  await page.getByRole('checkbox', { name: 'Show selected only' }).check();
  await expect(page.locator('.scale-note')).toContainText('0–80 CFM');
  expect(await widths()).toEqual(filtered);
  await page.getByRole('checkbox', { name: 'Show selected only' }).uncheck();
  await expect(page.locator('.scale-note')).toContainText('0–150 CFM');
});

test('long desktop charts keep headings and numeric ticks visible while scrolling', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile uses page-scrolling cards with a scale for each fan.');
  await page.goto('?lang=en');
  // Repeat DOM rows only for the layout check; production data stays untouched.
  await page.locator('.fan-rows').evaluate(rows => {
    const originals = [...rows.children];
    for (let i = originals.length; i < 37; i++) rows.append(originals[i % originals.length].cloneNode(true));
  });
  const heading = page.locator('.chart-heading');
  const initialTop = (await heading.boundingBox())!.y;
  await page.locator('.chart-view').evaluate(chart => { chart.scrollTop = 600; });
  await expect.poll(() => heading.evaluate(element => element.getBoundingClientRect().top)).toBe(initialTop);
  expect(await page.locator('.chart-view').evaluate(chart => chart.scrollTop)).toBeGreaterThan(0);
  await expect(heading.locator('.axis-labels').first()).toHaveText('020406080');
  await expect(heading.getByRole('button', { name: 'Sort by: Radiator', exact: true })).toBeInViewport();
});
