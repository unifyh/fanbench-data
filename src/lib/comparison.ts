import type { Application, Fan, Locale, ViewState } from '../types.ts';

export const applications: Application[] = ['case', 'heatsink', 'radiator'];
export const initialState: ViewState = { locale: 'en', query: '', sizes: [], thicknesses: [], brands: [], sort: 'case', direction: 'desc', selected: [], onlySelected: false, view: 'chart' };
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
    sizes: list(p, 'size').filter(value => allowedSizes.has(value)),
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
  if (state.sizes.length) p.set('size', state.sizes.join(','));
  if (state.thicknesses.length) p.set('thickness', state.thicknesses.join(','));
  if (state.brands.length) p.set('brand', state.brands.join(','));
  if (state.sort !== 'case') p.set('sort', state.sort);
  if (state.direction !== 'desc') p.set('order', state.direction);
  if (state.selected.length) p.set('fans', state.selected.join(','));
  if (state.onlySelected) p.set('selected', '1');
  if (state.view !== 'chart') p.set('view', state.view);
  return p.toString();
}

export function visibleFans(fans: Fan[], state: ViewState): Fan[] {
  const query = state.query.trim().toLocaleLowerCase();
  return fans.filter(fan => {
    const searchable = [fan.model, fan.brand, fan.brandLabel.en, fan.brandLabel['zh-Hans'], fan.sourceLabel].join(' ').toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (!state.sizes.length || state.sizes.includes(String(fan.sizeMm)))
      && (!state.thicknesses.length || state.thicknesses.includes(fan.thicknessMm === null ? 'unknown' : String(fan.thicknessMm)))
      && (!state.brands.length || state.brands.includes(fan.brand))
      && (!state.onlySelected || state.selected.includes(fan.id));
  }).sort((a, b) => {
    const delta = a.measurements[state.sort].airflowCfm - b.measurements[state.sort].airflowCfm;
    return (state.direction === 'asc' ? delta : -delta) || a.id.localeCompare(b.id);
  });
}

export function chartMaximum(fans: Fan[]): number {
  return Math.max(10, Math.ceil(Math.max(0, ...fans.flatMap(fan => applications.map(key => fan.measurements[key].airflowCfm))) / 10) * 10);
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

export function exportCsv(fans: Fan[], noiseDba: number, distanceCm: number, sourceUrl: string): string {
  const escape = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const rows: unknown[][] = [['brand', 'model', 'size_mm', 'thickness_mm', 'noise_dba', 'distance_cm', 'case_cfm', 'case_rpm', 'heatsink_cfm', 'heatsink_rpm', 'radiator_cfm', 'radiator_rpm', 'source_url']];
  for (const fan of fans) rows.push([fan.brandLabel.en, fan.model, fan.sizeMm, fan.thicknessMm, noiseDba, distanceCm, ...applications.flatMap(key => [fan.measurements[key].airflowCfm.toFixed(2), fan.measurements[key].rpm]), sourceUrl]);
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
