import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function observeImage(page: Page) {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { exportedTexts: texts });
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      texts.push(args[0]);
      return fillText.apply(this, args);
    };
  });
}

async function exportedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { exportedTexts: string[] }).exportedTexts);
}

async function downloadImage(page: Page, label = 'Download PNG') {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.length).toBeGreaterThan(10_000);
  return { download, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('PNG uses the filtered order, all columns and current language on desktop and mobile', async ({ page, isMobile }, testInfo) => {
  await observeImage(page);
  await page.goto('?lang=en&q=phanteks&sort=radiator&order=asc');
  if (isMobile) await page.getByRole('button', { name: 'Table', exact: true }).click();
  const first = await downloadImage(page);
  expect(first.width).toBe(2880);
  expect(first.download.suggestedFilename()).toBe('fanbench-data-36dba-en.png');
  let texts = await exportedTexts(page);
  expect(texts.indexOf('T30 120')).toBeLessThan(texts.indexOf('T30 140'));
  for (const text of ['Case · CFM', 'Heatsink · CFM', 'Radiator · CFM', '2 fans', '120 × 30 mm', '140 × 30 mm', 'Tests: 风向标 FanBench']) expect(texts).toContain(text);
  expect(texts.join(' ')).toContain('36 dBA @ 30 cm from intake');
  expect(texts.join(' ')).not.toContain('Watch review');
  expect(texts).not.toContain('MasterFan A140');
  await first.download.saveAs(testInfo.outputPath('chart-en.png'));

  await page.getByRole('checkbox', { name: 'Select T30 120', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Show selected only', exact: true }).check();
  await page.getByRole('button', { name: '简中', exact: true }).click();
  await page.evaluate(() => { (window as unknown as { exportedTexts: string[] }).exportedTexts.length = 0; });
  const selected = await downloadImage(page, '下载 PNG');
  expect(selected.download.suggestedFilename()).toBe('fanbench-data-36dba-zh-Hans.png');
  expect(selected.width).toBe(first.width);
  expect(selected.height).toBeLessThan(first.height);
  texts = await exportedTexts(page);
  for (const text of ['风向标测试数据汇总', '追风者', 'T30 120', '机箱 · CFM', '风冷散热器 · CFM', '冷排 · CFM', '测试：风向标 FanBench']) expect(texts).toContain(text);
  expect(texts).not.toContain('T30 140');
  await selected.download.saveAs(testInfo.outputPath('chart-zh.png'));
  await page.screenshot({ path: testInfo.outputPath('export-controls.png'), fullPage: true });
  await page.getByRole('searchbox').fill('no matching fan');
  await expect(page.getByRole('button', { name: '复制图片', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下载 PNG', exact: true })).toBeDisabled();
});

test('PNG includes every offscreen row and keeps missing measurements empty', async ({ page }, testInfo) => {
  await observeImage(page);
  await page.goto('?lang=en&size=all');
  const names = await page.locator('.fan-row .model-button').allTextContents();
  const result = await downloadImage(page);
  expect(names).toHaveLength(67);
  const texts = await exportedTexts(page);
  let last = -1;
  for (const name of names) {
    const next = texts.join(' ').indexOf(name, last + 1);
    expect(next).toBeGreaterThan(last);
    last = next;
  }
  expect(texts).toContain('67 fans');
  expect(texts).toContain('105.39');
  expect(texts.filter(text => text === '—')).toHaveLength(18);
  expect(texts).not.toContain('NaN');
  expect(result.height).toBeGreaterThan(6000);
  expect(result.height).toBeLessThanOrEqual(8192);
  expect(result.width * result.height).toBeLessThanOrEqual(16_000_000);
  await result.download.saveAs(testInfo.outputPath('chart-all.png'));
});

test('copy starts with user activation and waits for PNG encoding', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.setTimeout(() => original.apply(this, args), 150);
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        const activated = navigator.userActivation.isActive;
        const png = await items[0].getType('image/png');
        const bitmap = await createImageBitmap(png);
        Object.assign(window, { copiedImage: { activated, count: items.length, type: png.type, size: png.size, width: bitmap.width } });
        bitmap.close();
      },
    } });
  });
  await page.goto('?lang=en&q=T30');
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await expect(page.locator('.image-export-status')).toHaveText('Image copied');
  const copied = await page.evaluate(() => (window as unknown as { copiedImage: { activated: boolean; count: number; type: string; size: number; width: number } }).copiedImage);
  expect(copied).toMatchObject({ activated: true, count: 1, type: 'image/png', width: 2880 });
  expect(copied.size).toBeGreaterThan(10_000);
});

test('native clipboard accepts the generated PNG', async ({ page }) => {
  await page.goto('?lang=en&q=T30');
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await expect(page.locator('.image-export-status')).toHaveText('Image copied');
});

test('copied PNG can be pasted as an image', async ({ page, browserName }) => {
  // Bundled headless Firefox accepts PNG writes but returns no image data, even for a plain Blob.
  test.skip(browserName === 'firefox', 'Headless Firefox does not retain PNG clipboard data; native write and image generation are covered separately.');
  await page.goto('?lang=en&q=T30');
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await expect(page.locator('.image-export-status')).toHaveText('Image copied');
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.contentEditable = 'true';
    target.setAttribute('role', 'textbox');
    target.setAttribute('aria-label', 'Paste target');
    target.addEventListener('paste', async event => {
      event.preventDefault();
      const file = event.clipboardData?.files[0];
      if (!file) return;
      const bitmap = await createImageBitmap(file);
      target.textContent = file.type + ' ' + bitmap.width + 'px';
      bitmap.close();
    });
    document.body.append(target);
    target.focus();
  });
  await page.keyboard.press('Control+V');
  await expect(page.getByRole('textbox', { name: 'Paste target' })).toHaveText('image/png 2880px');
});

for (const unavailable of ['denied', 'unsupported', 'rendering'] as const) {
  test('image export recovers from ' + unavailable + ' failure', async ({ page }) => {
    await page.addInitScript(mode => {
      if (mode === 'unsupported') {
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: undefined });
      } else {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          write: async (items: ClipboardItem[]) => {
            if (mode === 'denied') throw new DOMException('Blocked', 'NotAllowedError');
            await items[0].getType('image/png');
          },
        } });
      }
      if (mode === 'rendering') {
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback) {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        };
      }
    }, unavailable);
    await page.goto('?lang=en&q=T30');
    await page.getByRole('button', { name: 'Copy image', exact: true }).click();
    await expect(page.locator('.image-export-status')).toHaveText(unavailable === 'rendering'
      ? 'Could not create the image. Try again or select fewer fans.'
      : 'Image copying is unavailable. Use Download PNG.');
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeEnabled();
    await downloadImage(page);
    await expect(page.locator('.image-export-status')).toHaveText('PNG download started');
  });
}
