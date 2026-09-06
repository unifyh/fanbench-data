import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { applications, chartScale, exportCsv, initialState, modelName, readState, serializeState, visibleFans } from '../src/lib/comparison.ts';
import { buildComparison, buildCorrections } from '../src/lib/catalog.ts';
import type { Catalog, DataCorrection, FanRecord, ViewState } from '../src/types.ts';

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const fanDirectory = new URL('../src/data/fans/', import.meta.url);
const records: FanRecord[] = readdirSync(fanDirectory).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(new URL(file, fanDirectory), 'utf8')));
const fans = buildComparison(records, catalog);
const p14Record = records.find(fan => fan.id === 'arctic-p14-pro-pst')!;
const correctionRecords: DataCorrection[] = JSON.parse(readFileSync(new URL('../src/data/corrections.json', import.meta.url), 'utf8'));

test('documented corrections match the chart, CSV and referenced episodes', () => {
  const corrections = buildCorrections(correctionRecords, fans, catalog);
  assert.deepEqual(corrections.map(correction => [correction.episode.number, correction.reportedValue, correction.correctedValue]), [
    [10, 1815, 1851],
    [20, 1905, 1908],
  ]);
  for (const correction of corrections) {
    assert.equal(correction.fan.measurements[correction.application]?.[correction.field], correction.correctedValue);
    assert.ok(exportCsv([correction.fan], catalog).includes(`"${correction.correctedValue}"`));
    assert.ok(!exportCsv([correction.fan], catalog).includes(`"${correction.reportedValue}"`));
    assert.ok(correction.references.length);
  }
});

test('corrections reject missing measurements and unrelated episode references', () => {
  const correction = correctionRecords[0];
  for (const patch of [{ fanId: 'missing' }, { resultId: 'missing' }]) {
    assert.throws(() => buildCorrections([{ ...correction, ...patch }], fans, catalog), /Missing correction measurement/);
  }
  for (const patch of [{ episodeId: 'missing' }, { episodeId: 'ep001' }, { confirmedIn: ['ep001'] }]) {
    assert.throws(() => buildCorrections([{ ...correction, ...patch }], fans, catalog), /Invalid correction episode/);
  }
  for (const confirmedIn of [[], [correction.episodeId]]) {
    assert.throws(() => buildCorrections([{ ...correction, confirmedIn }], fans, catalog), /Missing independent correction reference/);
  }
  assert.throws(() => buildCorrections([{ ...correction, reportedValue: 1851 }], fans, catalog), /Invalid reported correction value/);
});

test('source data keeps 104 operating points, identities, conditions and precision', () => {
  assert.equal(catalog.noise.noiseDba, 36);
  assert.equal(catalog.noise.distanceCm, 30);
  assert.equal(new Set(fans.map(fan => fan.id)).size, fans.length);
  assert.equal(fans.length, 40);
  assert.equal(fans.reduce((total, fan) => total + Object.keys(fan.measurements).length, 0), 104);
  for (const fan of fans) {
    assert.ok(fan.brandLabel.en && fan.brandLabel['zh-Hans']);
    assert.ok(fan.model.en);
    assert.ok(fan.comparisonResult.sources.length);
    assert.ok(fan.sizeMm > 0);
    if (fan.thicknessMm !== null) {
      assert.ok(fan.thicknessMm > 0);
    }
    for (const value of Object.values(fan.measurements)) {
      assert.ok(Number.isFinite(value.airflowCfm) && value.airflowCfm > 0);
      assert.ok(Number.isInteger(value.rpm) && value.rpm > 0);
    }
  }
  const a140 = fans.find(fan => fan.id === 'cooler-master-masterfan-a140')!;
  assert.equal(a140.measurements.case?.airflowCfm, 66.96);
  assert.equal(a140.measurements.radiator?.airflowCfm, 41.95);
  assert.equal(fans.filter(fan => fan.dedicatedReviewUrl !== null).length, 25);
});

test('each application sorts every fan using its own measurement without changing other values', () => {
  assert.deepEqual(visibleFans(fans, { ...initialState, sort: 'heatsink' }).slice(0, 5).map(fan => fan.model.en), ['LP14E', '9RA1412P1G001', 'MACH140', 'T30 140', '9RA1212P1K001']);
  const radiator = visibleFans(fans, { ...initialState, sort: 'radiator' });
  assert.deepEqual(radiator.slice(0, 5).map(fan => fan.model.en), ['LP14E', '9RA1412P1G001', 'T30 140', 'MasterFan A140', 'P14 Pro PST']);
  assert.equal(radiator[2].measurements.case?.airflowCfm, 59.56);
  assert.equal(visibleFans(fans, { ...initialState, sort: 'radiator', direction: 'asc' })[0].model.en, 'NF-A12x15 PWM');
});

test('case-only fans sort last for missing applications in either direction and remain selectable', () => {
  const havn = fans.find(fan => fan.id === 'havn-h18-performance')!;
  const asus = fans.find(fan => fan.id === 'asus-pa602-case-fan')!;
  const a140 = fans.find(fan => fan.id === 'cooler-master-masterfan-a140')!;
  const t30 = fans.find(fan => fan.id === 'phanteks-t30-140')!;
  const subset = [havn, a140, asus, t30];
  const allSizes = { ...initialState, sizes: [] };
  assert.deepEqual(visibleFans(subset, allSizes), [havn, asus, a140, t30]);
  assert.deepEqual(visibleFans(subset, { ...allSizes, direction: 'asc' }), [t30, a140, asus, havn]);
  for (const sort of ['heatsink', 'radiator'] as const) {
    assert.deepEqual(visibleFans(subset, { ...allSizes, sort }), [t30, a140, asus, havn]);
    assert.deepEqual(visibleFans(subset, { ...allSizes, sort, direction: 'asc' }), [a140, t30, asus, havn]);
    assert.deepEqual(visibleFans(subset, { ...allSizes, sort, selected: [havn.id], onlySelected: true }), [havn]);
  }
  assert.deepEqual(chartScale([havn]), { maximum: 150, ticks: [0, 50, 100, 150] });
});

test('filters OR within a field, AND across fields, including unknown thickness', () => {
  const filtered = visibleFans(fans, { ...initialState, sizes: ['120', '140'], thicknesses: ['30', '38'], brands: ['cooler-master', 'phanteks'] });
  assert.deepEqual(filtered.map(fan => fan.model.en), ['MasterFan A140', 'T30 140', 'MasterFan A120', 'T30 120']);
  assert.deepEqual(visibleFans(fans, { ...initialState, thicknesses: ['30'] }).map(fan => fan.model.en), ['MasterFan A140', 'MACH140', 'L207 case fan', 'T30 140', 'MasterFan A120', 'T30 120', 'F9 R120', 'MACH120']);
  const unknownThickness = { ...fans[0], thicknessMm: null };
  assert.deepEqual(visibleFans([unknownThickness], { ...initialState, thicknesses: ['unknown'] }), [unknownThickness]);
  assert.deepEqual(readState('?thickness=unknown', 'en', [unknownThickness]).thicknesses, ['unknown']);
  assert.equal(visibleFans(fans, { ...initialState, sizes: ['120'], brands: ['havn'] }).length, 0);
  assert.equal(visibleFans(fans, { ...initialState, query: '酷冷至尊' }).length, 5);
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
  assert.deepEqual(chartScale(fans), { maximum: 150, ticks: [0, 50, 100, 150] });
  assert.deepEqual(chartScale(visibleFans(fans, initialState)), { maximum: 80, ticks: [0, 20, 40, 60, 80] });
  assert.deepEqual(chartScale(visibleFans(fans, { ...initialState, query: 'R25' })), { maximum: 60, ticks: [0, 20, 40, 60] });
  const empty = chartScale([]);
  assert.ok(empty.maximum > 0);
  assert.equal(empty.ticks.at(-1), empty.maximum);
  for (const maximum of [0.8, 20, 39.9, 50, 70.01, 100, 121]) {
    const fan = structuredClone(fans[0]);
    for (const key of applications) fan.measurements[key] = { airflowCfm: maximum, rpm: 1000 };
    const scale = chartScale([fan]);
    assert.ok(scale.maximum >= maximum);
    assert.ok(scale.maximum <= maximum * 1.5);
    assert.equal(scale.ticks[0], 0);
    assert.equal(scale.ticks.at(-1), scale.maximum);
    assert.ok(scale.ticks.length >= 3 && scale.ticks.length <= 5);
  }
});

test('size defaults apply only without a URL override, and All survives sharing and reloads', () => {
  assert.deepEqual(readState('', 'en', fans), initialState);
  assert.deepEqual(readState('?lang=zh-Hans&q=P28', 'en', fans).sizes, ['120', '140']);
  assert.deepEqual(visibleFans(fans, initialState), fans.filter(fan => [120, 140].includes(fan.sizeMm)).sort((a, b) => b.measurements.case!.airflowCfm - a.measurements.case!.airflowCfm));
  for (const sizes of [[], ['180'], ['120', '140'], ['140', '120']]) {
    const state = { ...initialState, sizes };
    assert.deepEqual(readState('?' + serializeState(state), 'en', fans), state);
  }
  const all = readState('?size=all', 'en', fans);
  assert.deepEqual(all.sizes, []);
  assert.equal(visibleFans(fans, all).length, fans.length);
  assert.deepEqual(readState('?size=', 'en', fans).sizes, []);
  assert.deepEqual(readState('?size=180,180,invalid', 'en', fans).sizes, ['180']);
});

test('share URLs round-trip the full bilingual filtered shortlist and reject invalid values', () => {
  const state: ViewState = { ...initialState, locale: 'zh-Hans', query: '酷冷至尊', sizes: ['140'], thicknesses: ['30'], brands: ['cooler-master'], sort: 'radiator', direction: 'asc', selected: ['cooler-master-masterfan-a140'], onlySelected: true, view: 'table' };
  assert.deepEqual(readState('?' + serializeState(state), 'en', fans), state);
  const sanitized = readState('?lang=xx&sort=nope&size=400,140&thickness=24,30,unknown&brand=missing&fans=missing', 'zh-Hans', fans.filter(fan => fan.thicknessMm !== null));
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
  assert.equal(output.split('\r\n').length, 41);
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
  const noctua = fans.filter(fan => fan.id === 'noctua-nf-a12x25-g2-pwm');
  assert.equal(noctua.length, 1);
  assert.equal(noctua[0].results.length, 1);
  assert.deepEqual(noctua[0].comparisonResult.sources, ['ep009', 'ep010', 'ep011', 'ep012', 'ep015', 'ep016', 'ep017', 'ep018', 'ep019', 'ep020', 'ep035', 'ep036'].map(episodeId => ({ episodeId })));
  assert.equal(noctua[0].measurements.radiator?.rpm, 1851);
  assert.ok(exportCsv(noctua, catalog).includes(catalog.episodes.ep035.url + ' | ' + catalog.episodes.ep036.url));
  for (const id of ['sanyo-denki-9wpa1212p4j001', 'sanyo-denki-9ra1212p4g001', 'phanteks-t30-120']) {
    const repeated = fans.filter(fan => fan.id === id);
    assert.equal(repeated.length, 1);
    assert.equal(repeated[0].results.length, 1);
    const episodes = ['ep001', 'ep002', 'ep003', 'ep004', 'ep006', 'ep007', 'ep008', 'ep009'];
    if (id === 'phanteks-t30-120') episodes.push('ep010', 'ep013', 'ep021');
    assert.deepEqual(repeated[0].comparisonResult.sources, episodes.map(episodeId => ({ episodeId })));
    assert.ok(exportCsv(repeated, catalog).includes(catalog.episodes.ep001.url + ' | ' + catalog.episodes.ep002.url));
  }
  const record = structuredClone(p14Record);
  const nextCatalog = structuredClone(catalog);
  nextCatalog.episodes.ep038 = { number: 38, url: 'https://example.com/ep038' };
  record.results[0].sources.push({ episodeId: 'ep038' });
  const comparison = buildComparison([record], nextCatalog);
  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].results.length, 1);
  assert.equal(comparison[0].comparisonResult.sources.length, p14Record.results[0].sources.length + 1);
  assert.deepEqual(comparison[0].measurements, p14Record.results[0].measurements);
  assert.ok(exportCsv(comparison, nextCatalog).includes(catalog.episodes.ep037.url + ' | https://example.com/ep038'));
});

test('case-only results export empty measurement cells without losing recorded values or sources', () => {
  const havn = fans.find(fan => fan.id === 'havn-h18-performance')!;
  assert.deepEqual(havn.measurements, { case: { airflowCfm: 105.39, rpm: 931 } });
  const csv = exportCsv([havn], catalog);
  assert.ok(csv.includes('"105.39","931","","","","","l207-nhd15-27mm-radiator"'));
  assert.ok(csv.includes(catalog.episodes.ep005.url));
  assert.ok(!csv.includes('undefined') && !csv.includes('NaN'));
  assert.equal(visibleFans(fans, { ...initialState, sizes: [], query: 'HAVN BF360 case fan' })[0].id, havn.id);
  const nfA14 = fans.find(fan => fan.id === 'noctua-nf-a14x25-g2-pwm')!;
  assert.equal(nfA14.results.length, 2);
  assert.deepEqual(nfA14.results[0].sources, [{ episodeId: 'ep005' }]);
  assert.deepEqual(nfA14.results[0].measurements, { case: { airflowCfm: 66.18, rpm: 1355 } });
  assert.deepEqual(nfA14.comparisonResult.sources, [{ episodeId: 'ep014' }]);
  assert.deepEqual(nfA14.measurements, {
    case: { airflowCfm: 66.18, rpm: 1355 },
    heatsink: { airflowCfm: 51.61, rpm: 1340 },
    radiator: { airflowCfm: 38.88, rpm: 1370 },
  });
});

test('validation accepts partial results and rejects empty, unknown or invalid measurements', () => {
  const partial = structuredClone(records[0]);
  partial.results[0].measurements = { case: { airflowCfm: 105.39, rpm: 931 } };
  assert.deepEqual(buildComparison([partial], catalog)[0].measurements, partial.results[0].measurements);
  const empty = structuredClone(partial);
  empty.results[0].measurements = {};
  assert.throws(() => buildComparison([empty], catalog), /Result has no measurements/);
  const unknown = structuredClone(partial);
  Object.assign(unknown.results[0].measurements, { unknown: { airflowCfm: 10, rpm: 1000 } });
  assert.throws(() => buildComparison([unknown], catalog), /Unknown application/);
  for (const measurement of [
    { airflowCfm: 0, rpm: 931 },
    { airflowCfm: NaN, rpm: 931 },
    { airflowCfm: Infinity, rpm: 931 },
    { airflowCfm: 105.39, rpm: 0 },
    { airflowCfm: 105.39, rpm: 931.5 },
    null,
  ]) {
    const invalid = structuredClone(partial);
    Object.assign(invalid.results[0].measurements, { case: measurement });
    assert.throws(() => buildComparison([invalid], catalog), /Invalid measurement/);
  }
});

test('retests only change displayed values when explicitly selected, with their own provenance', () => {
  const record = structuredClone(p14Record);
  const nextCatalog = structuredClone(catalog);
  nextCatalog.episodes.ep040 = { number: 40, url: 'https://example.com/ep040' };
  const retest = structuredClone(record.results[0]);
  retest.id = 'retest';
  retest.measurements.case = { airflowCfm: 70.25, rpm: 1800 };
  retest.sources = [{ episodeId: 'ep040' }];
  record.results.push(retest);
  assert.deepEqual(buildComparison([record], nextCatalog)[0].measurements, p14Record.results[0].measurements);
  record.comparisonResultId = 'retest';
  const comparison = buildComparison([record], nextCatalog);
  assert.equal(comparison[0].measurements.case?.airflowCfm, 70.25);
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
