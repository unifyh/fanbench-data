import rawCatalog from './catalog.json';
import { buildComparison } from '../lib/catalog';
import type { Catalog, FanRecord } from '../types';

export const catalog: Catalog = rawCatalog;
const files = import.meta.glob<FanRecord>('./fans/*.json', { eager: true, import: 'default' });
export const fanRecords = Object.values(files).sort((a, b) => a.id.localeCompare(b.id));
export const fans = buildComparison(fanRecords, catalog);
export const testSetup = catalog.testSetups[catalog.comparisonSetupId];
