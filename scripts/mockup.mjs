import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const directory = new URL('../src/data/fans/', import.meta.url);
const fans = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).map(async file => {
  const fan = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  const result = fan.results.find(result => result.id === fan.comparisonResultId);
  return { ...fan, measurements: result.measurements };
}));
const template = await readFile(new URL('../mockups/original-style.html', import.meta.url), 'utf8');
await mkdir('dist', { recursive: true });
await mkdir('test-results', { recursive: true });
await writeFile('dist/mockup.html', template.replace('__FAN_DATA__', JSON.stringify(fans).replaceAll('<', '\u003c')));
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173/fanbench-data/mockup.html');
  await page.locator('.bar').first().waitFor();
  await page.screenshot({ path: 'test-results/mockup-original.png', fullPage: true });
  const scaleCheck = await page.evaluate(() => ({ forty: makeScale(39), fifty: makeScale(48), catalog: scale }));
  const widthBefore = await page.locator('.case .bar').first().evaluate(element => element.getBoundingClientRect().width);
  await page.locator('#brand').selectOption('sanyo-denki');
  const widthAfter = await page.locator('.case .bar').first().evaluate(element => element.getBoundingClientRect().width);
  if (Math.abs(widthBefore - widthAfter) > 1) throw new Error('Filtering changed the scale');
  await page.goto('http://127.0.0.1:4173/fanbench-data/mockup.html?rows=37');
  await page.locator('.chart-scroll').evaluate(element => { element.scrollTop = 900; });
  const stickyCheck = await page.evaluate(() => ({ rows: document.querySelectorAll('.fan-label').length, viewport: document.querySelector('.chart-scroll').getBoundingClientRect().top, heading: document.querySelector('.case .column-head').getBoundingClientRect().top }));
  if (stickyCheck.rows !== 37 || Math.abs(stickyCheck.viewport - stickyCheck.heading) > 1) throw new Error('Sticky axis preview failed');
  await page.screenshot({ path: 'test-results/mockup-long.png', fullPage: true });
  console.log(JSON.stringify({ scaleCheck, stickyCheck }));
  console.log('Local mockup: http://127.0.0.1:4173/fanbench-data/mockup.html');
} finally { await browser.close(); }
