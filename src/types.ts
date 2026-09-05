export type Locale = 'en' | 'zh-Hans';
export type Application = 'case' | 'heatsink' | 'radiator';
export type Localized = Record<Locale, string>;
export interface Measurement { airflowCfm: number; rpm: number }
export interface Fan {
  id: string;
  brand: string;
  brandLabel: Localized;
  model: string;
  sourceLabel: string;
  sizeMm: number;
  thicknessMm: number | null;
  dimensionsSource: string | null;
  dimensionsNote: Localized | null;
  dedicatedReviewUrl: string | null;
  measurements: Record<Application, Measurement>;
}
export interface Dataset {
  schemaVersion: number;
  source: { episode: number; url: string; reviewer: string; profileUrl: string; screenshot: string; videoTimestampSeconds: number | null };
  methodology: { id: string; noiseDba: number; distanceCm: number; measurementPosition: Localized; fixtures: Record<Application, Localized> };
  fans: Fan[];
}
export interface ViewState {
  locale: Locale;
  query: string;
  sizes: string[];
  thicknesses: string[];
  brands: string[];
  sort: Application;
  direction: 'desc' | 'asc';
  selected: string[];
  onlySelected: boolean;
  view: 'chart' | 'table';
}
