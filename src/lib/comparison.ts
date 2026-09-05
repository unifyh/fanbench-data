import type { Application, Catalog, Fan, FanRecord, Locale, ViewState } from '../types.ts';

export const applications: Application[] = ['case', 'heatsink', 'radiator'];
export const initialState: ViewState = { locale: 'en', query: '', sizes: ['120', '140'], thicknesses: [], brands: [], sort: 'case', direction: 'desc', selected: [], onlySelected: false, view: 'chart' };
const list = (params: URLSearchParams, key: string) => [...new Set((params.get(key) ?? '').split(',').filter(Boolean))];

export function readState(search: string, preferredLocale: Locale, fans: Fan[]): ViewState {
  const p = new URLSearchParams(search);
  const allowedSizes = new Set(fans.map(fan => String(fan.sizeMm)));
  const allowedThicknesses = new Set(fans.map(fan => fan.thicknessMm === null ? 'unknown' : String(fan.thicknessMm)));
  const ids = new Set(fans.map(fan => fan.id));
  const brands = new Set(fans.map(fan => fan.brand));
  const locale = p.get('lang');
  const sort = p.get('sort');
  return {
    ...initialState,
    locale: locale === 'en' || locale === 'zh-Hans' ? locale : preferredLocale,
    query: p.get('q') ?? '',
    sizes: (p.has('size') ? list(p, 'size') : initialState.sizes).filter(value => allowedSizes.has(value)),
    thicknesses: list(p, 'thickness').filter(value => allowedThicknesses.has(value)),
    brands: list(p, 'brand').filter(value => brands.has(value)),
    sort: applications.includes(sort as Application) ? sort as Application : 'case',
    direction: p.get('order') === 'asc' ? 'asc' : 'desc',
    selected: list(p, 'fans').filter(id => ids.has(id)),
    onlySelected: p.get('selected') === '1',
    view: p.get('view') === 'table' ? 'table' : 'chart',
  };
}

export function serializeState(state: ViewState): string {
  const p = new URLSearchParams({ lang: state.locale });
  if (state.query) p.set('q', state.query);
  p.set('size', state.sizes.length ? state.sizes.join(',') : 'all');
  if (state.thicknesses.length) p.set('thickness', state.thicknesses.join(','));
  if (state.brands.length) p.set('brand', state.brands.join(','));
  if (state.sort !== 'case') p.set('sort', state.sort);
  if (state.direction !== 'desc') p.set('order', state.direction);
  if (state.selected.length) p.set('fans', state.selected.join(','));
  if (state.onlySelected) p.set('selected', '1');
  if (state.view !== 'chart') p.set('view', state.view);
  return p.toString();
}

export function modelName(fan: FanRecord, locale: Locale): string {
  return fan.model[locale] ?? fan.model.en;
}

export function visibleFans(fans: Fan[], state: ViewState): Fan[] {
  const query = state.query.trim().toLocaleLowerCase();
  return fans.filter(fan => {
    const names = [...Object.values(fan.model), ...(fan.aliases ?? [])];
    const brands = [fan.brand, ...Object.values(fan.brandLabel)];
    const searchable = [...names, ...brands, ...brands.flatMap(brand => names.map(name => `${brand} ${name}`))];
    return (!query || searchable.some(value => value.toLocaleLowerCase().includes(query)))
      && (!state.sizes.length || state.sizes.includes(String(fan.sizeMm)))
      && (!state.thicknesses.length || state.thicknesses.includes(fan.thicknessMm === null ? 'unknown' : String(fan.thicknessMm)))
      && (!state.brands.length || state.brands.includes(fan.brand))
      && (!state.onlySelected || state.selected.includes(fan.id));
  }).sort((a, b) => {
    const aValue = a.measurements[state.sort];
    const bValue = b.measurements[state.sort];
    if (!aValue || !bValue) return Number(!aValue) - Number(!bValue) || a.id.localeCompare(b.id);
    const delta = aValue.airflowCfm - bValue.airflowCfm;
    return (state.direction === 'asc' ? delta : -delta) || a.id.localeCompare(b.id);
  });
}

export function chartScale(fans: Fan[]): { maximum: number; ticks: number[] } {
  const largest = Math.max(1, ...fans.flatMap(fan => applications.flatMap(key => {
    const value = fan.measurements[key];
    return value ? [value.airflowCfm] : [];
  })));
  const roughStep = largest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= roughStep)! * magnitude;
  const maximum = Math.ceil(largest / step) * step;
  return {
    maximum,
    ticks: Array.from({ length: Math.round(maximum / step) + 1 }, (_, index) => Number((index * step).toPrecision(10))),
  };
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

export function exportCsv(fans: Fan[], catalog: Catalog, locale: Locale = 'en'): string {
  const escape = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const rows: unknown[][] = [['brand', 'model', 'size_mm', 'thickness_mm', 'noise_dba', 'distance_cm', 'case_cfm', 'case_rpm', 'heatsink_cfm', 'heatsink_rpm', 'radiator_cfm', 'radiator_rpm', 'test_setup', 'result_id', 'source_urls']];
  for (const fan of fans) {
    const urls = [...new Set(fan.comparisonResult.sources.map(source => catalog.episodes[source.episodeId].url))];
    rows.push([fan.brandLabel[locale], modelName(fan, locale), fan.sizeMm, fan.thicknessMm, catalog.noise.noiseDba, catalog.noise.distanceCm, ...applications.flatMap(key => {
      const value = fan.measurements[key];
      return value ? [value.airflowCfm.toFixed(2), value.rpm] : [null, null];
    }), catalog.comparisonSetupId, fan.comparisonResult.id, urls.join(' | ')]);
  }
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
