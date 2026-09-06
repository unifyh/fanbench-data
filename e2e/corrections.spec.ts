import { test, expect } from '@playwright/test';

test('footer corrections show both typos in either language without changing the comparison', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['en', 'zh-Hans']) {
    await page.goto(`?lang=${locale}&q=HAVN&size=all`);
    const chinese = locale === 'zh-Hans';
    const title = chinese ? '数据勘误' : 'Data corrections';
    const trigger = page.getByRole('contentinfo').getByRole('button', { name: title, exact: true });
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(page.locator('.fan-row')).toHaveCount(1);
    const url = page.url();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(title);
    await expect(dialog).toContainText(chinese ? '本非官方汇总站维护' : 'maintained by this unofficial archive');
    const entries = dialog.getByRole('listitem');
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText(chinese ? '猫头鹰' : 'Noctua');
    await expect(entries.nth(0)).toContainText('NF-A12x25 G2 PWM');
    await expect(entries.nth(1)).toContainText('XPG');
    await expect(entries.nth(1)).toContainText('VENTO PRO 120 PWM');
    for (const [index, values] of [['1815 RPM', '1851 RPM'], ['1905 RPM', '1908 RPM']].entries()) {
      await expect(entries.nth(index).locator('.correction-measurement')).toHaveText(chinese ? '冷排' : 'Radiator');
      await expect(entries.nth(index).locator('dt')).toHaveText(chinese ? ['视频标注', '本站采用'] : ['In video', 'Value used']);
      await expect(entries.nth(index).locator('dd')).toHaveText(values);
      await expect(entries.nth(index).locator('.correction-reason')).toContainText(chinese ? '对照其他期数中的同一测试结果后修正' : 'cross-checking the same result in other episodes');
    }
    for (const [episode, video] of [
      ['EP010', 'BV1kJrPBnEVR'], ['EP009', 'BV1zXiMB1EE9'], ['EP011', 'BV1C8kTBPE2C'],
      ['EP020', 'BV1rk9LB7Esr'], ['EP018', 'BV1JFcmzQEGk'], ['EP019', 'BV1MUwezvENE'], ['EP035', 'BV1PJ8E6MEb4'],
    ]) {
      await expect(dialog.getByRole('link', { name: episode, exact: true })).toHaveAttribute('href', `https://www.bilibili.com/video/${video}/`);
    }
    const close = dialog.getByRole('button', { name: chinese ? '关闭' : 'Close', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'EP010', exact: true })).toBeFocused();
    const contained = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight
        && element.scrollWidth <= element.clientWidth;
    });
    expect(contained).toBe(true);
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('searchbox')).toHaveValue('HAVN');
    await expect(page.locator('.fan-row')).toHaveCount(1);
    expect(page.url()).toBe(url);
  }
  expect(errors).toEqual([]);
});
