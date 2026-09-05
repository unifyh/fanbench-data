export type Locale = 'en' | 'zh-Hans';
export type Application = 'case' | 'heatsink' | 'radiator';
export type Localized = Record<Locale, string>;
export interface Measurement { airflowCfm: number; rpm: number }
export type Measurements = Partial<Record<Application, Measurement>>;
export interface ResultSource {
  episodeId: string;
}
export interface FanResult {
  id: string;
  sources: ResultSource[];
  measurements: Measurements;
}
export interface FanRecord {
  id: string;
  brand: string;
  model: { en: string; 'zh-Hans'?: string };
  aliases?: string[];
  sizeMm: number;
  thicknessMm: number | null;
  dedicatedReviewUrl: string | null;
  comparisonResultId: string;
  results: FanResult[];
}
export interface Fan extends FanRecord {
  brandLabel: Localized;
  comparisonResult: FanResult;
  measurements: Measurements;
}
export interface Catalog {
  schemaVersion: number;
  reviewer: { name: string; profileUrl: string };
  brands: Record<string, Localized>;
  noise: { noiseDba: number; distanceCm: number; measurementPosition: Localized };
  comparisonSetupId: string;
  testSetups: Record<string, { fixtures: Record<Application, Localized> }>;
  episodes: Record<string, { number: number; url: string }>;
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
