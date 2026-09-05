import type { Catalog, Fan, FanRecord } from '../types.ts';

export function buildComparison(records: FanRecord[], catalog: Catalog): Fan[] {
  const fanIds = new Set<string>();
  if (!catalog.testSetups[catalog.comparisonSetupId]) throw new Error('Unknown comparison setup');

  return records.map(record => {
    if (fanIds.has(record.id)) throw new Error(`Duplicate fan ID: ${record.id}`);
    fanIds.add(record.id);
    const resultIds = new Set<string>();
    for (const result of record.results) {
      if (resultIds.has(result.id)) throw new Error(`Duplicate result ID: ${record.id}/${result.id}`);
      resultIds.add(result.id);
      if (!catalog.testSetups[result.testSetupId]) throw new Error(`Unknown test setup: ${result.testSetupId}`);
      if (!result.sources.length) throw new Error(`Result has no source: ${record.id}/${result.id}`);
      for (const source of result.sources) {
        if (!catalog.episodes[source.episodeId]) throw new Error(`Unknown episode: ${source.episodeId}`);
      }
    }
    const comparisonResult = record.results.find(result => result.id === record.comparisonResultId);
    if (!comparisonResult) throw new Error(`Missing comparison result: ${record.id}/${record.comparisonResultId}`);
    if (comparisonResult.testSetupId !== catalog.comparisonSetupId) throw new Error(`Incompatible comparison setup: ${record.id}`);
    return { ...record, comparisonResult, measurements: comparisonResult.measurements };
  });
}
