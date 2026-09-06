import type { Catalog, DataCorrection, Fan, FanRecord } from '../types.ts';
import { applications } from './comparison.ts';

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
      const entries = Object.entries(result.measurements);
      if (!entries.length) throw new Error(`Result has no measurements: ${record.id}/${result.id}`);
      for (const [application, value] of entries) {
        if (!applications.some(key => key === application)) throw new Error(`Unknown application: ${application}`);
        if (!value || !Number.isFinite(value.airflowCfm) || value.airflowCfm <= 0 || !Number.isInteger(value.rpm) || value.rpm <= 0) {
          throw new Error(`Invalid measurement: ${record.id}/${result.id}/${application}`);
        }
      }
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

export function buildCorrections(records: DataCorrection[], fans: Fan[], catalog: Catalog) {
  return records.map(record => {
    const fan = fans.find(fan => fan.id === record.fanId);
    const result = fan?.results.find(result => result.id === record.resultId);
    const correctedValue = result?.measurements[record.application]?.[record.field];
    if (!fan || !result || correctedValue === undefined) throw new Error('Missing correction measurement');
    if (!Number.isFinite(record.reportedValue) || record.reportedValue <= 0 || record.reportedValue === correctedValue) {
      throw new Error('Invalid reported correction value');
    }
    const resolveEpisode = (id: string) => {
      const episode = catalog.episodes[id];
      if (!episode || !result.sources.some(source => source.episodeId === id)) throw new Error('Invalid correction episode');
      return episode;
    };
    if (!record.confirmedIn.length || record.confirmedIn.includes(record.episodeId)) throw new Error('Missing independent correction reference');
    return {
      ...record, fan, correctedValue,
      episode: resolveEpisode(record.episodeId),
      references: record.confirmedIn.map(resolveEpisode),
    };
  });
}
