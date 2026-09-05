import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [name, width, height, locale] of [['desktop-en', 1440, 1100, 'en'], ['mobile-en', 390, 844, 'en'], ['mobile-zh', 390, 844, 'zh-Hans']]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:4173/fanbench-data/?lang=' + locale);
    await page.screenshot({ path: 'test-results/' + name + '.png', fullPage: true });
    console.log(name + ': ' + await page.title());
    await page.close();
  }
} finally { await browser.close(); }
