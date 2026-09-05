import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applications, chartMaximum, exportCsv, initialState, readState, serializeState, visibleFans } from '../src/lib/comparison.ts';
import type { Dataset, ViewState } from '../src/types.ts';

const dataset: Dataset = JSON.parse(readFileSync(new URL('../src/data/ep037.json', import.meta.url), 'utf8'));
const fans = dataset.fans;

test('source data keeps 18 complete operating points, identities, conditions and precision', () => {
  assert.equal(dataset.methodology.noiseDba, 36);
  assert.equal(dataset.methodology.distanceCm, 30);
  assert.equal(new Set(fans.map(fan => fan.id)).size, fans.length);
  assert.equal(fans.length, 6);
  for (const fan of fans) {
    assert.ok(fan.brandLabel.en && fan.brandLabel['zh-Hans']);
    assert.ok(fan.sourceLabel);
    assert.ok(fan.sizeMm > 0);
    if (fan.thicknessMm !== null) {
      assert.ok(fan.thicknessMm > 0);
      assert.ok(fan.dimensionsSource?.startsWith('https://'));
    } else {
      assert.ok(fan.dimensionsNote?.en);
      assert.ok(fan.dimensionsNote?.['zh-Hans']);
    }
    for (const key of applications) {
      assert.ok(Number.isFinite(fan.measurements[key].airflowCfm) && fan.measurements[key].airflowCfm > 0);
      assert.ok(Number.isInteger(fan.measurements[key].rpm) && fan.measurements[key].rpm > 0);
    }
  }
  const a140 = fans.find(fan => fan.id === 'cooler-master-masterfan-a140')!;
  assert.equal(a140.measurements.case.airflowCfm, 66.96);
  assert.equal(a140.measurements.radiator.airflowCfm, 41.95);
  assert.equal(fans.filter(fan => fan.dedicatedReviewUrl !== null).length, 1);
});

test('each application sorts every fan using its own measurement without changing other values', () => {
  assert.deepEqual(visibleFans(fans, { ...initialState, sort: 'heatsink' }).map(fan => fan.model), ['9RA1412P1G001', 'MACH140', 'T30 140', 'MasterFan A140', 'P14 Pro PST', 'MasterFan A120']);
  const radiator = visibleFans(fans, { ...initialState, sort: 'radiator' });
  assert.deepEqual(radiator.map(fan => fan.model), ['9RA1412P1G001', 'T30 140', 'MasterFan A140', 'P14 Pro PST', 'MasterFan A120', 'MACH140']);
  assert.equal(radiator[1].measurements.case.airflowCfm, 59.56);
  assert.equal(visibleFans(fans, { ...initialState, sort: 'radiator', direction: 'asc' })[0].model, 'MACH140');
});

test('filters OR within a field, AND across fields, including unknown thickness', () => {
  const filtered = visibleFans(fans, { ...initialState, sizes: ['120', '140'], thicknesses: ['30', '38'], brands: ['cooler-master', 'phanteks'] });
  assert.deepEqual(filtered.map(fan => fan.model), ['MasterFan A140', 'T30 140']);
  assert.deepEqual(visibleFans(fans, { ...initialState, thicknesses: ['unknown'] }).map(fan => fan.model), ['MACH140', 'MasterFan A120']);
  assert.equal(visibleFans(fans, { ...initialState, sizes: ['120'], brands: ['arctic'] }).length, 0);
  assert.equal(visibleFans(fans, { ...initialState, query: '酷冷至尊' }).length, 2);
  assert.equal(visibleFans(fans, { ...initialState, query: '  p14 PRO  ' })[0].brand, 'arctic');
});

test('chart scale stays comparable regardless of the current filter', () => {
  assert.equal(chartMaximum(fans), 70);
  assert.equal(chartMaximum([]), 10);
});

test('share URLs round-trip the full bilingual filtered shortlist and reject invalid values', () => {
  const state: ViewState = { ...initialState, locale: 'zh-Hans', query: '酷冷至尊', sizes: ['140'], thicknesses: ['30'], brands: ['cooler-master'], sort: 'radiator', direction: 'asc', selected: ['cooler-master-masterfan-a140'], onlySelected: true, view: 'table' };
  assert.deepEqual(readState('?' + serializeState(state), 'en', fans), state);
  const sanitized = readState('?lang=xx&sort=nope&size=400,140&thickness=25,unknown&brand=missing&fans=missing', 'zh-Hans', fans);
  assert.equal(sanitized.locale, 'zh-Hans');
  assert.equal(sanitized.sort, 'case');
  assert.deepEqual(sanitized.sizes, ['140']);
  assert.deepEqual(sanitized.thicknesses, ['unknown']);
  assert.deepEqual(sanitized.selected, []);
});

test('shortlist is explicit and survives unrelated filters', () => {
  const state: ViewState = { ...initialState, selected: ['phanteks-t30-140'], onlySelected: true };
  assert.equal(visibleFans(fans, state)[0].model, 'T30 140');
  assert.equal(visibleFans(fans, { ...state, brands: ['arctic'] }).length, 0);
  assert.deepEqual(state.selected, ['phanteks-t30-140']);
});

test('CSV exports units, conditions and provenance; unknown thickness stays empty', () => {
  const output = exportCsv(fans, 36, 30, dataset.source.url);
  assert.equal(output.split('\r\n').length, 7);
  assert.ok(output.includes('"66.96","1463"'));
  assert.ok(output.includes('"MACH140","140","","36","30"'));
  assert.ok(output.includes('"https://www.bilibili.com/video/BV1NQti6HErx/"'));
});
