import rawCatalog from './catalog.json';
import rawCorrections from './corrections.json';
import { buildComparison, buildCorrections } from '../lib/catalog';
import type { Catalog, DataCorrection, FanRecord } from '../types';

export const catalog: Catalog = rawCatalog;
const files = import.meta.glob<FanRecord>('./fans/*.json', { eager: true, import: 'default' });
export const fanRecords = Object.values(files).sort((a, b) => a.id.localeCompare(b.id));
export const fans = buildComparison(fanRecords, catalog);
export const corrections = buildCorrections(rawCorrections as DataCorrection[], fans, catalog);
export const testSetup = catalog.testSetups[catalog.comparisonSetupId];
