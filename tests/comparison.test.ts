import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { applications, chartScale, exportCsv, initialState, modelName, readState, serializeState, visibleFans } from '../src/lib/comparison.ts';
import { buildComparison } from '../src/lib/catalog.ts';
import type { Catalog, FanRecord, ViewState } from '../src/types.ts';

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const fanDirectory = new URL('../src/data/fans/', import.meta.url);
const records: FanRecord[] = readdirSync(fanDirectory).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(new URL(file, fanDirectory), 'utf8')));
const fans = buildComparison(records, catalog);

test('source data keeps 30 complete operating points, identities, conditions and precision', () => {
  assert.equal(catalog.noise.noiseDba, 36);
  assert.equal(catalog.noise.distanceCm, 30);
  assert.equal(new Set(fans.map(fan => fan.id)).size, fans.length);
  assert.equal(fans.length, 10);
  for (const fan of fans) {
    assert.ok(fan.brandLabel.en && fan.brandLabel['zh-Hans']);
    assert.ok(fan.model.en);
    assert.ok(fan.comparisonResult.sources.length);
    assert.ok(fan.sizeMm > 0);
    if (fan.thicknessMm !== null) {
      assert.ok(fan.thicknessMm > 0);
    }
    for (const key of applications) {
      assert.ok(Number.isFinite(fan.measurements[key].airflowCfm) && fan.measurements[key].airflowCfm > 0);
      assert.ok(Number.isInteger(fan.measurements[key].rpm) && fan.measurements[key].rpm > 0);
    }
  }
  const a140 = fans.find(fan => fan.id === 'cooler-master-masterfan-a140')!;
  assert.equal(a140.measurements.case.airflowCfm, 66.96);
  assert.equal(a140.measurements.radiator.airflowCfm, 41.95);
  assert.equal(fans.filter(fan => fan.dedicatedReviewUrl !== null).length, 2);
});

test('each application sorts every fan using its own measurement without changing other values', () => {
  assert.deepEqual(visibleFans(fans, { ...initialState, sort: 'heatsink' }).map(fan => fan.model.en), ['9RA1412P1G001', 'MACH140', 'T30 140', 'MasterFan A140', 'P14 Pro PST', 'MasterFan A120', 'NF-A12x25 G2 PWM', 'R25 LCP PRO', 'Gentle Typhoon GT-3000 PWM', 'Silent Wings Pro 4 120mm PWM']);
  const radiator = visibleFans(fans, { ...initialState, sort: 'radiator' });
  assert.deepEqual(radiator.map(fan => fan.model.en), ['9RA1412P1G001', 'T30 140', 'MasterFan A140', 'P14 Pro PST', 'MasterFan A120', 'MACH140', 'NF-A12x25 G2 PWM', 'Gentle Typhoon GT-3000 PWM', 'Silent Wings Pro 4 120mm PWM', 'R25 LCP PRO']);
  assert.equal(radiator[1].measurements.case.airflowCfm, 59.56);
  assert.equal(visibleFans(fans, { ...initialState, sort: 'radiator', direction: 'asc' })[0].model.en, 'R25 LCP PRO');
});

test('filters OR within a field, AND across fields, including unknown thickness', () => {
  const filtered = visibleFans(fans, { ...initialState, sizes: ['120', '140'], thicknesses: ['30', '38'], brands: ['cooler-master', 'phanteks'] });
  assert.deepEqual(filtered.map(fan => fan.model.en), ['MasterFan A140', 'T30 140', 'MasterFan A120']);
  assert.deepEqual(visibleFans(fans, { ...initialState, thicknesses: ['30'] }).map(fan => fan.model.en), ['MasterFan A140', 'MACH140', 'T30 140', 'MasterFan A120']);
  const unknownThickness = { ...fans[0], thicknessMm: null };
  assert.deepEqual(visibleFans([unknownThickness], { ...initialState, thicknesses: ['unknown'] }), [unknownThickness]);
  assert.deepEqual(readState('?thickness=unknown', 'en', [unknownThickness]).thicknesses, ['unknown']);
  assert.equal(visibleFans(fans, { ...initialState, sizes: ['120'], brands: ['arctic'] }).length, 0);
  assert.equal(visibleFans(fans, { ...initialState, query: '酷冷至尊' }).length, 2);
  assert.equal(visibleFans(fans, { ...initialState, query: '  p14 PRO  ' })[0].brand, 'arctic');
});

test('product names localize with an English fallback and search matches either language', () => {
  const scythe = fans.find(fan => fan.id === 'scythe-gentle-typhoon-gt-3000-pwm')!;
  const r25 = fans.find(fan => fan.id === 'ryvntec-r25-lcp-pro')!;
  assert.equal(modelName(scythe, 'en'), 'Gentle Typhoon GT-3000 PWM');
  assert.equal(modelName(scythe, 'zh-Hans'), '温柔台风 GT-3000 PWM');
  assert.equal(modelName(r25, 'zh-Hans'), 'R25 LCP PRO');
  for (const locale of ['en', 'zh-Hans'] as const) {
    for (const query of ['温柔台风', '大镰刀 温柔台风 GT-3000 PWM', 'Scythe Gentle Typhoon GT-3000 PWM', 'Scythe 温柔台风 GT-3000 PWM']) {
      assert.deepEqual(visibleFans(fans, { ...initialState, locale, query }).map(fan => fan.id), [scythe.id]);
    }
    for (const query of ['RYVNTEC R25 LCP PRO', '睿温 R25 LCP PRO']) {
      assert.deepEqual(visibleFans(fans, { ...initialState, locale, query }).map(fan => fan.id), [r25.id]);
    }
    assert.equal(visibleFans(fans, { ...initialState, locale, query: '猫头鹰 NF-A12×25 G2 PWM' })[0].id, 'noctua-nf-a12x25-g2-pwm');
    assert.equal(visibleFans(fans, { ...initialState, locale, query: '酷冷至尊 MasterFan A140' })[0].id, 'cooler-master-masterfan-a140');
  }
});

test('shared scale covers all applications with readable ticks across catalog ranges', () => {
  assert.deepEqual(chartScale(fans), { maximum: 80, ticks: [0, 20, 40, 60, 80] });
  const empty = chartScale([]);
  assert.ok(empty.maximum > 0);
  assert.equal(empty.ticks.at(-1), empty.maximum);
  for (const maximum of [0.8, 20, 39.9, 50, 70.01, 100, 121]) {
    const fan = structuredClone(fans[0]);
    for (const key of applications) fan.measurements[key].airflowCfm = maximum;
    const scale = chartScale([fan]);
    assert.ok(scale.maximum >= maximum);
    assert.ok(scale.maximum <= maximum * 1.5);
    assert.equal(scale.ticks[0], 0);
    assert.equal(scale.ticks.at(-1), scale.maximum);
    assert.ok(scale.ticks.length >= 3 && scale.ticks.length <= 5);
  }
});

test('share URLs round-trip the full bilingual filtered shortlist and reject invalid values', () => {
  const state: ViewState = { ...initialState, locale: 'zh-Hans', query: '酷冷至尊', sizes: ['140'], thicknesses: ['30'], brands: ['cooler-master'], sort: 'radiator', direction: 'asc', selected: ['cooler-master-masterfan-a140'], onlySelected: true, view: 'table' };
  assert.deepEqual(readState('?' + serializeState(state), 'en', fans), state);
  const sanitized = readState('?lang=xx&sort=nope&size=400,140&thickness=24,30,unknown&brand=missing&fans=missing', 'zh-Hans', fans);
  assert.equal(sanitized.locale, 'zh-Hans');
  assert.equal(sanitized.sort, 'case');
  assert.deepEqual(sanitized.sizes, ['140']);
  assert.deepEqual(sanitized.thicknesses, ['30']);
  assert.deepEqual(sanitized.selected, []);
});

test('shortlist is explicit and survives unrelated filters', () => {
  const state: ViewState = { ...initialState, selected: ['phanteks-t30-140'], onlySelected: true };
  assert.equal(visibleFans(fans, state)[0].model.en, 'T30 140');
  assert.equal(visibleFans(fans, { ...state, brands: ['arctic'] }).length, 0);
  assert.deepEqual(state.selected, ['phanteks-t30-140']);
});

test('CSV exports units, conditions and provenance; unknown thickness stays empty', () => {
  const output = exportCsv(fans, catalog);
  assert.equal(output.split('\r\n').length, 11);
  assert.ok(output.includes('"66.96","1463"'));
  assert.ok(output.includes('"MACH140","140","30","36","30"'));
  assert.ok(output.includes('"MasterFan A120","120","30","36","30"'));
  const unknownThickness = { ...fans.find(fan => fan.model.en === 'MACH140')!, thicknessMm: null };
  assert.ok(exportCsv([unknownThickness], catalog).includes('"MACH140","140","","36","30"'));
  assert.ok(output.includes('"https://www.bilibili.com/video/BV1NQti6HErx/"'));
  assert.ok(output.includes('"Scythe","Gentle Typhoon GT-3000 PWM"'));
  assert.ok(output.includes('"l207-nhd15-27mm-radiator","baseline","https://www.bilibili.com/video/BV15gtc6YEuu/"'));
  const chinese = exportCsv(fans, catalog, 'zh-Hans');
  assert.ok(chinese.includes('"大镰刀","温柔台风 GT-3000 PWM"'));
  assert.ok(chinese.includes('"睿温","R25 LCP PRO"'));
});

test('repeated appearances keep one fan and preserve all episode references', () => {
  const record = structuredClone(records[0]);
  const nextCatalog = structuredClone(catalog);
  nextCatalog.episodes.ep038 = { number: 38, url: 'https://example.com/ep038' };
  record.results[0].sources.push({ episodeId: 'ep038' });
  const comparison = buildComparison([record], nextCatalog);
  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].results.length, 1);
  assert.equal(comparison[0].comparisonResult.sources.length, 2);
  assert.deepEqual(comparison[0].measurements, records[0].results[0].measurements);
  assert.ok(exportCsv(comparison, nextCatalog).includes(catalog.episodes.ep037.url + ' | https://example.com/ep038'));
});

test('retests only change displayed values when explicitly selected, with their own provenance', () => {
  const record = structuredClone(records[0]);
  const nextCatalog = structuredClone(catalog);
  nextCatalog.episodes.ep040 = { number: 40, url: 'https://example.com/ep040' };
  const retest = structuredClone(record.results[0]);
  retest.id = 'retest';
  retest.measurements.case = { airflowCfm: 70.25, rpm: 1800 };
  retest.sources = [{ episodeId: 'ep040' }];
  record.results.push(retest);
  assert.deepEqual(buildComparison([record], nextCatalog)[0].measurements, records[0].results[0].measurements);
  record.comparisonResultId = 'retest';
  const comparison = buildComparison([record], nextCatalog);
  assert.equal(comparison[0].measurements.case.airflowCfm, 70.25);
  assert.equal(comparison[0].results.length, 2);
  const csv = exportCsv(comparison, nextCatalog);
  assert.ok(csv.includes('"70.25","1800"'));
  assert.ok(csv.includes('https://example.com/ep040'));
  assert.ok(!csv.includes(catalog.episodes.ep037.url));
});

test('duplicate fans or results, missing selections, invalid references and missing model names are rejected', () => {
  assert.throws(() => buildComparison([records[0], records[0]], catalog), /Duplicate fan ID/);
  const duplicateResult = structuredClone(records[0]);
  duplicateResult.results.push(structuredClone(duplicateResult.results[0]));
  assert.throws(() => buildComparison([duplicateResult], catalog), /Duplicate result ID/);
  const missing = structuredClone(records[0]);
  missing.comparisonResultId = 'missing';
  assert.throws(() => buildComparison([missing], catalog), /Missing comparison result/);
  const unknownEpisode = structuredClone(records[0]);
  unknownEpisode.results[0].sources[0].episodeId = 'missing';
  assert.throws(() => buildComparison([unknownEpisode], catalog), /Unknown episode/);
  const unknownBrand = { ...records[0], brand: 'missing' };
  assert.throws(() => buildComparison([unknownBrand], catalog), /Unknown brand/);
  const missingName = { ...records[0], model: { en: '' } };
  assert.throws(() => buildComparison([missingName], catalog), /Missing English model name/);
  const emptyTranslation = { ...records[0], model: { en: records[0].model.en, 'zh-Hans': ' ' } };
  assert.throws(() => buildComparison([emptyTranslation], catalog), /Invalid Chinese model name/);
  const nextCatalog = structuredClone(catalog);
  nextCatalog.comparisonSetupId = 'missing';
  assert.throws(() => buildComparison(records, nextCatalog), /Unknown comparison setup/);
});
