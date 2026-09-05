import type { Catalog, Fan, FanRecord } from '../types.ts';

export function buildComparison(records: FanRecord[], catalog: Catalog): Fan[] {
  const fanIds = new Set<string>();
  if (!catalog.testSetups[catalog.comparisonSetupId]) throw new Error('Unknown comparison setup');

  return records.map(record => {
    if (fanIds.has(record.id)) throw new Error(`Duplicate fan ID: ${record.id}`);
    fanIds.add(record.id);
    const brandLabel = catalog.brands[record.brand];
    if (!brandLabel) throw new Error(`Unknown brand: ${record.brand}`);
    if (!brandLabel.en?.trim() || !brandLabel['zh-Hans']?.trim()) throw new Error(`Missing brand label: ${record.brand}`);
    if (typeof record.model?.en !== 'string' || !record.model.en.trim()) throw new Error(`Missing English model name: ${record.id}`);
    if (record.model['zh-Hans'] !== undefined && (typeof record.model['zh-Hans'] !== 'string' || !record.model['zh-Hans'].trim())) {
      throw new Error(`Invalid Chinese model name: ${record.id}`);
    }
    const resultIds = new Set<string>();
    for (const result of record.results) {
      if (resultIds.has(result.id)) throw new Error(`Duplicate result ID: ${record.id}/${result.id}`);
      resultIds.add(result.id);
      if (!result.sources.length) throw new Error(`Result has no source: ${record.id}/${result.id}`);
      for (const source of result.sources) {
        if (!catalog.episodes[source.episodeId]) throw new Error(`Unknown episode: ${source.episodeId}`);
      }
    }
    const comparisonResult = record.results.find(result => result.id === record.comparisonResultId);
    if (!comparisonResult) throw new Error(`Missing comparison result: ${record.id}/${record.comparisonResultId}`);
    return { ...record, brandLabel, comparisonResult, measurements: comparisonResult.measurements };
  });
}
