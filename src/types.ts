export type Locale = 'en' | 'zh-Hans';
export type Application = 'case' | 'heatsink' | 'radiator';
export type Localized = Record<Locale, string>;
export interface Measurement { airflowCfm: number; rpm: number }
export interface ResultSource {
  episodeId: string;
  sourceLabel: string;
  videoTimestampSeconds: number | null;
}
export interface FanResult {
  id: string;
  testSetupId: string;
  sources: ResultSource[];
  measurements: Record<Application, Measurement>;
}
export interface FanRecord {
  id: string;
  brand: string;
  brandLabel: Localized;
  model: string;
  aliases: string[];
  sizeMm: number;
  thicknessMm: number | null;
  dimensionsSource: string | null;
  dedicatedReviewUrl: string | null;
  comparisonResultId: string;
  results: FanResult[];
}
export interface Fan extends FanRecord {
  comparisonResult: FanResult;
  measurements: Record<Application, Measurement>;
}
export interface Catalog {
  schemaVersion: number;
  reviewer: { name: string; profileUrl: string };
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
