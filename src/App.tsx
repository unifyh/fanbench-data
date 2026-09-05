import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import rawData from './data/ep037.json';
import { messages } from './i18n';
import { applications, chartMaximum, exportCsv, readState, serializeState, toggleValue, visibleFans } from './lib/comparison';
import type { Application, Dataset, Fan, Locale, ViewState } from './types';

const dataset: Dataset = rawData;
const fans = dataset.fans;
const maxCfm = chartMaximum(fans);
const repositoryUrl = 'https://github.com/unifyh/fan-compare';

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    down: <><path d="M12 4v16m-6-6 6 6 6-6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    filter: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
    share: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" /></>,
    chart: <><path d="M4 4v16h16M8 8h10M8 12h7M8 16h4" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M10 4v16" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    case: <><rect x="6" y="2" width="12" height="20" rx="2" /><circle cx="12" cy="9" r="3" /><circle cx="12" cy="17" r="2" /></>,
    heatsink: <><path d="M4 5h16M4 9h16M4 13h16M4 17h16M8 3v16a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3" /></>,
    radiator: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M11 5v14M15 5v14M19 5v14M7 2v3M17 2v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.info}</svg>;
}

function FanMark() {
  return <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><rect width="40" height="40" rx="10" fill="currentColor" /><g fill="#fff"><path d="M21 17C17 11 20 5 26 7c8 3 4 11-5 10Z" /><path d="M23 21c6-4 12-1 10 5-3 8-11 4-10-5Z" /><path d="M19 23c4 6 1 12-5 10-8-3-4-11 5-10Z" /><path d="M17 19c-6 4-12 1-10-5 3-8 11-4 10 5Z" /><circle cx="20" cy="20" r="3" /></g></svg>;
}

function preferredLocale(): Locale {
  try {
    const saved = localStorage.getItem('fan-compare-language');
    if (saved === 'en' || saved === 'zh-Hans') return saved;
  } catch { /* Browser storage is optional. */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-Hans' : 'en';
}

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<Icon name="arrow" size={13} /></a>;
}

function FormFactor({ fan, locale }: { fan: Fan; locale: Locale }) {
  const t = messages[locale];
  return <span className={fan.thicknessMm === null ? 'form-factor unverified' : 'form-factor'}>{fan.thicknessMm === null
    ? <>{fan.sizeMm} mm <span className="dimension-divider">·</span> {t.unverifiedThickness}</>
    : <>{fan.sizeMm} × {fan.thicknessMm} mm</>}</span>;
}

function FanDetails({ fan, locale, onClose }: { fan: Fan | null; locale: Locale; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = messages[locale];
  useEffect(() => {
    if (fan && !ref.current?.open) ref.current?.showModal();
    if (!fan && ref.current?.open) ref.current?.close();
  }, [fan]);
  return <dialog ref={ref} className="fan-dialog" aria-labelledby="detail-title" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {fan && <div className="dialog-inner">
      <button className="icon-button dialog-close" onClick={onClose} aria-label={t.close}><Icon name="close" /></button>
      <span className="eyebrow">{fan.brandLabel[locale]}</span>
      <h2 id="detail-title">{fan.model}</h2>
      <FormFactor fan={fan} locale={locale} />
      {fan.dimensionsNote && <p className="detail-note">{fan.dimensionsNote[locale]}</p>}
      <p className="detail-condition">36 dBA · {dataset.methodology.measurementPosition[locale]}</p>
      <div className="detail-results">{applications.map(key => <div key={key}>
        <span className={'application-label ' + key}><Icon name={key} />{t[key]}</span>
        <strong>{fan.measurements[key].airflowCfm.toFixed(2)} <small>CFM</small></strong>
        <span>{fan.measurements[key].rpm} RPM</span>
      </div>)}</div>
      <div className="detail-links">
        <ExternalLink href={dataset.source.url}>{t.resultSource} · EP037</ExternalLink>
        {fan.dimensionsSource && <ExternalLink href={fan.dimensionsSource}>{t.dimensionsSource}</ExternalLink>}
        {fan.dedicatedReviewUrl ? <ExternalLink href={fan.dedicatedReviewUrl}>{t.dedicatedReview}</ExternalLink> : <p>{t.reviewUnavailable}</p>}
      </div>
    </div>}
  </dialog>;
}

export default function App() {
  const [state, setState] = useState<ViewState>(() => readState(location.search, preferredLocale(), fans));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailFan, setDetailFan] = useState<Fan | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const t = messages[state.locale];
  const shown = useMemo(() => visibleFans(fans, state), [state]);
  const sizes = [...new Set(fans.map(fan => fan.sizeMm))].sort((a, b) => a - b);
  const thicknesses = [...new Set(fans.map(fan => fan.thicknessMm).filter(value => value !== null))].sort((a, b) => a - b);
  const brands = [...new Map(fans.map(fan => [fan.brand, fan.brandLabel])).entries()].sort((a, b) => a[1].en.localeCompare(b[1].en));
  const activeFilters = state.sizes.length + state.thicknesses.length + state.brands.length;
  const hasFilters = activeFilters > 0 || state.query.length > 0 || state.onlySelected;
  const update = (patch: Partial<ViewState>) => setState(previous => ({ ...previous, ...patch }));
  const toggleFilter = (key: 'sizes' | 'thicknesses' | 'brands', value: string) => setState(previous => ({ ...previous, [key]: toggleValue(previous[key], value) }));
  const resetFilters = () => update({ query: '', sizes: [], thicknesses: [], brands: [], onlySelected: false });
  const toggleSelection = (id: string) => setState(previous => ({ ...previous, selected: toggleValue(previous.selected, id) }));
  const sortBy = (key: Application) => update({ sort: key, direction: state.sort === key && state.direction === 'desc' ? 'asc' : 'desc' });

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.title = state.locale === 'en' ? 'Fan Compare — More airflow. Same noise.' : '风扇对比 — 同样安静，更多风量';
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.intro + ' ' + t.independent);
    try { localStorage.setItem('fan-compare-language', state.locale); } catch { /* Storage is optional. */ }
  }, [state.locale, t]);

  useEffect(() => {
    const nextUrl = location.pathname + '?' + serializeState(state) + location.hash;
    if (nextUrl !== location.pathname + location.search + location.hash) history.replaceState(null, '', nextUrl);
  }, [state]);

  useEffect(() => {
    const restore = () => setState(readState(location.search, preferredLocale(), fans));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    if (shareStatus === 'copied') {
      const timer = window.setTimeout(() => setShareStatus('idle'), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [shareStatus]);

  async function share() {
    try { await navigator.clipboard.writeText(location.href); setShareStatus('copied'); }
    catch { setShareStatus('fallback'); }
  }

  function download() {
    const csv = exportCsv(shown, dataset.methodology.noiseDba, dataset.methodology.distanceCm, dataset.source.url);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'fan-compare-36dba-ep037.csv'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderFanIdentity(fan: Fan) {
    return <div className="fan-identity">
      <div className="fan-title-line">
        <input type="checkbox" className="fan-checkbox" aria-label={`${t.select} ${fan.model}`} checked={state.selected.includes(fan.id)} onChange={() => toggleSelection(fan.id)} />
        <div className="fan-name"><span className="brand-name">{fan.brandLabel[state.locale]}</span><button className="model-button" onClick={() => setDetailFan(fan)} aria-label={`${t.details}: ${fan.model}`}>{fan.model}<Icon name="info" size={13} /></button></div>
      </div>
      <div className="fan-metadata"><FormFactor fan={fan} locale={state.locale} /><div className="source-links">
        <ExternalLink href={dataset.source.url}>{t.measurements}</ExternalLink>
        {fan.dedicatedReviewUrl && <ExternalLink href={fan.dedicatedReviewUrl}>{t.dedicatedReview}</ExternalLink>}
      </div></div>
    </div>;
  }

  function renderColumnHeading(application: Application) {
    return <button className={`column-sort ${application} ${state.sort === application ? 'is-sorted' : ''}`} onClick={() => sortBy(application)} aria-label={`${t.sortBy}: ${t[application]}`}>
      <span><Icon name={application} size={19} />{t[application]}<span className={state.direction === 'asc' && state.sort === application ? 'sort-arrow reversed' : 'sort-arrow'}><Icon name="down" size={14} /></span></span>
      <small>{t.airflow} · CFM</small>
    </button>;
  }

  return <>
    <a className="skip-link" href="#comparison">{t.skip}</a>
    <header className="site-header"><div className="header-inner">
      <a className="wordmark" href="#" aria-label="Fan Compare"><FanMark /><span>fan<span className="wordmark-light">compare</span><span className="wordmark-dot">.</span></span></a>
      <nav aria-label={t.siteName}><a className="nav-active" href="#comparison">{t.compare}</a><a href="#methodology">{t.methodology}</a><ExternalLink href={dataset.source.url}>{t.source}</ExternalLink></nav>
      <div className="language-switch" aria-label="Language / 语言"><button lang="en" aria-pressed={state.locale === 'en'} onClick={() => update({ locale: 'en' })}>EN</button><button lang="zh-Hans" aria-pressed={state.locale === 'zh-Hans'} onClick={() => update({ locale: 'zh-Hans' })}>简中</button></div>
    </div></header>
    <main>
      <section className="hero page-width">
        <div className="hero-copy"><div className="eyebrow"><span className="status-dot" />{t.eyebrow}</div><h1>{t.titleFirst}<br /><span>{t.titleSecond}</span></h1><p className="hero-intro">{t.intro}</p><p className="independent-note"><Icon name="info" size={14} />{t.independent}</p></div>
        <div className="noise-card">
          <div className="noise-card-top"><span>{t.noiseLevel}</span><span className="condition-chip">{t.allAt} 36 dBA</span></div>
          <div className="noise-number">36<span>dBA</span><div className="sound-waves" aria-hidden="true">{[14, 24, 38, 54, 36, 64, 48, 78, 54, 35, 48, 24, 16].map((height, i) => <i key={i} style={{ height }} />)}</div></div>
          <div className="noise-card-bottom"><div><strong>30 <small>cm</small></strong><span>{t.micDistance}</span></div><div><strong>03</strong><span>{t.applications}</span></div><div className="small-fan"><FanMark /></div></div>
        </div>
      </section>

      <section id="comparison" className="comparison page-width" aria-labelledby="comparison-title">
        <div className="section-heading"><div><h2 id="comparison-title">{t.database}<span className="count-badge">{fans.length.toString().padStart(2, '0')}</span></h2><p>{t.databaseHint}</p></div><button className="button secondary share-button" onClick={share}><Icon name={shareStatus === 'copied' ? 'check' : 'share'} />{shareStatus === 'copied' ? t.copied : t.share}</button></div>
        {shareStatus === 'fallback' && <label className="share-fallback">{t.shareFallback}<input readOnly value={location.href} onFocus={event => event.currentTarget.select()} /></label>}
        <div className="comparison-panel">
          <div className="filter-toolbar">
            <label className="search-field"><Icon name="search" /><input type="search" aria-label={t.search} placeholder={t.search} value={state.query} onChange={event => update({ query: event.target.value })} /></label>
            <div className="toolbar-right"><label className="sort-select"><span>{t.sortBy}</span><select aria-label={t.sortBy} value={state.sort} onChange={event => update({ sort: event.target.value as Application, direction: 'desc' })}>{applications.map(key => <option key={key} value={key}>{t[key]}</option>)}</select></label><button className="icon-button direction-button" aria-label={state.direction === 'desc' ? t.descending : t.ascending} onClick={() => update({ direction: state.direction === 'desc' ? 'asc' : 'desc' })}><span className={state.direction === 'asc' ? 'reversed' : ''}><Icon name="down" /></span></button><div className="view-toggle"><button aria-label={t.chart} aria-pressed={state.view === 'chart'} onClick={() => update({ view: 'chart' })}><Icon name="chart" /></button><button aria-label={t.table} aria-pressed={state.view === 'table'} onClick={() => update({ view: 'table' })}><Icon name="table" /></button></div></div>
          </div>
          <button className="mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="filter-fields" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" />{t.filters}{activeFilters > 0 && <span className="count-badge">{activeFilters}</span>}<span className="filter-toggle-indicator">{filtersOpen ? '−' : '+'}</span></button>
          <div id="filter-fields" className={'filter-fields' + (filtersOpen ? ' open' : '')}>
            <fieldset><legend>{t.size}</legend><div className="filter-options"><button aria-pressed={!state.sizes.length} onClick={() => update({ sizes: [] })}>{t.all}</button>{sizes.map(size => <button key={size} aria-pressed={state.sizes.includes(String(size))} onClick={() => toggleFilter('sizes', String(size))}>{size} mm</button>)}</div></fieldset>
            <fieldset><legend>{t.thickness}</legend><div className="filter-options"><button aria-pressed={!state.thicknesses.length} onClick={() => update({ thicknesses: [] })}>{t.all}</button>{thicknesses.map(thickness => <button key={thickness} aria-pressed={state.thicknesses.includes(String(thickness))} onClick={() => toggleFilter('thicknesses', String(thickness))}>{thickness} mm</button>)}<button aria-pressed={state.thicknesses.includes('unknown')} onClick={() => toggleFilter('thicknesses', 'unknown')}>{t.unknown}</button></div></fieldset>
            <fieldset className="brand-filter"><legend>{t.brand}</legend><div className="filter-options"><button aria-pressed={!state.brands.length} onClick={() => update({ brands: [] })}>{t.all}</button>{brands.map(([id, label]) => <button key={id} aria-pressed={state.brands.includes(id)} onClick={() => toggleFilter('brands', id)}>{label[state.locale]}</button>)}</div></fieldset>
          </div>
          <div className="results-toolbar"><div className="results-count" role="status">{t.showing} <strong>{shown.length}</strong> {t.of} {fans.length} {t.fans}{hasFilters && <button className="text-button" onClick={resetFilters}>{t.reset}</button>}</div><span className="higher-better"><Icon name="arrow" size={14} />{t.higherBetter}</span></div>
          {(state.selected.length > 0 || state.onlySelected) && <div className="selection-toolbar"><span><strong>{state.selected.length}</strong> {t.selected}</span><label><input type="checkbox" checked={state.onlySelected} onChange={event => update({ onlySelected: event.target.checked })} />{t.onlySelected}</label><button className="text-button" onClick={() => update({ selected: [], onlySelected: false })}>{t.clearSelection}</button></div>}

          {shown.length === 0 ? <div className="empty-state"><Icon name="search" size={36} /><h3>{t.noResults}</h3><p>{t.noResultsHint}</p><button className="button primary" onClick={resetFilters}>{t.reset}</button></div> : state.view === 'chart' ? <div className="chart-view">
            <div className="chart-heading comparison-grid"><div className="fan-column-label">{t.fan}<small>{t.dimensions}</small></div>{applications.map(key => <div key={key}>{renderColumnHeading(key)}<div className="axis-labels" aria-hidden="true"><span>0</span><span>{maxCfm / 2}</span><span>{maxCfm}</span></div></div>)}</div>
            <div className="fan-rows">{shown.map(fan => <article className={'fan-row comparison-grid' + (state.selected.includes(fan.id) ? ' selected' : '')} key={fan.id} data-fan-id={fan.id} aria-label={`${fan.brandLabel[state.locale]} ${fan.model}`}>
              {renderFanIdentity(fan)}
              <div className="mobile-measurements">{applications.map(key => <div className={`measurement-cell ${key}`} key={key}>
                <span className="mobile-application">{t[key]}</span>
                <div className="measurement-values"><strong>{fan.measurements[key].airflowCfm.toFixed(2)}<small> CFM</small></strong><span>{fan.measurements[key].rpm} <small>RPM</small></span></div>
                <div className="bar-track" aria-hidden="true"><div className="bar" style={{ '--bar-width': `${fan.measurements[key].airflowCfm / maxCfm * 100}%` } as CSSProperties} /></div>
              </div>)}</div>
            </article>)}</div>
          </div> : <div className="table-scroll" role="region" aria-label={t.table} tabIndex={0}><table><caption className="sr-only">{t.tableCaption}</caption><thead><tr><th scope="col">{t.fan}</th>{applications.map(key => <th scope="col" key={key} aria-sort={state.sort === key ? state.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>{renderColumnHeading(key)}</th>)}</tr></thead><tbody>{shown.map(fan => <tr key={fan.id} className={state.selected.includes(fan.id) ? 'selected' : ''}><th scope="row">{renderFanIdentity(fan)}</th>{applications.map(key => <td key={key}><strong>{fan.measurements[key].airflowCfm.toFixed(2)} <small>CFM</small></strong><span>{fan.measurements[key].rpm} RPM</span></td>)}</tr>)}</tbody></table></div>}
          <div className="chart-footer"><span><span className="status-dot" />36 dBA · {dataset.methodology.measurementPosition[state.locale]}</span><span>{t.commonScale}: 0–{maxCfm} CFM</span></div>
        </div>
        <div className="data-caption"><p><Icon name="info" size={15} />{t.sourceNote}</p><button className="text-button download-button" onClick={download}><Icon name="download" size={16} />{t.download}</button></div>
      </section>

      <section id="methodology" className="methodology page-width" aria-labelledby="methodology-title">
        <div className="methodology-heading"><span className="eyebrow">{t.methodology}</span><h2 id="methodology-title">{t.methodologyTitle}</h2><p>{t.methodologyIntro}</p></div>
        <div className="fixture-grid">{applications.map((key, i) => <div className={`fixture ${key}`} key={key}><div className="fixture-icon"><Icon name={key} size={25} /><span>0{i + 1}</span></div><h3>{t[key]}</h3><p>{dataset.methodology.fixtures[key][state.locale]}</p></div>)}</div>
        <div className="method-notes"><details><summary>{t.measured}<span>+</span></summary><p>{t.measuredText}</p></details><details><summary>{t.context}<span>+</span></summary><p>{t.contextText}</p></details><details><summary>{t.provenance}<span>+</span></summary><p>{t.provenanceText}</p><p>{t.unverifiedNote}</p><ExternalLink href={dataset.source.url}>FanBench · EP037</ExternalLink></details></div>
      </section>
    </main>
    <footer className="site-footer"><div className="page-width footer-inner"><div><a className="wordmark" href="#"><FanMark /><span>fan<span className="wordmark-light">compare</span>.</span></a><p>{t.footer}</p></div><div className="footer-attribution"><p>{t.disclaimer}</p><div><ExternalLink href={dataset.source.profileUrl}>风向标 FanBench</ExternalLink><ExternalLink href={repositoryUrl}>{t.openSource}</ExternalLink></div></div></div></footer>
    <FanDetails fan={detailFan} locale={state.locale} onClose={() => setDetailFan(null)} />
  </>;
}
