import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { catalog, fans, testSetup } from './data';
import { messages } from './i18n';
import { applications, chartScale, exportCsv, modelName, readState, serializeState, toggleValue, visibleFans } from './lib/comparison';
import type { Application, Fan, Locale, ViewState } from './types';

// Calculate once from the whole catalog: filtering and sorting must not resize bars.
const scale = chartScale(fans);

function ChartAxis({ bottom = false }: { bottom?: boolean }) {
  return <div className={'axis-labels' + (bottom ? ' bottom-axis' : ' top-axis')} aria-hidden="true">
    {scale.ticks.map(value => <span key={value} style={{ left: `${value / scale.maximum * 100}%` }}>{value}</span>)}
  </div>;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    down: <><path d="M12 4v16m-6-6 6 6 6-6" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
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

function preferredLocale(): Locale {
  try {
    const saved = localStorage.getItem('fanbench-data-language') ?? localStorage.getItem('fan-compare-language');
    if (saved === 'en' || saved === 'zh-Hans') return saved;
  } catch { /* Browser storage is optional. */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-Hans' : 'en';
}

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<Icon name="arrow" size={13} /></a>;
}

function FormFactor({ fan, locale }: { fan: Fan; locale: Locale }) {
  const t = messages[locale];
  const note = fan.thicknessMm === null ? `${fan.sizeMm} mm · ${t.unverifiedThickness}` : undefined;
  return <span className={fan.thicknessMm === null ? 'form-factor unverified' : 'form-factor'} title={note} aria-label={note}>{fan.sizeMm} × {fan.thicknessMm ?? '?'} mm</span>;
}

function FilterField({ id, label, allLabel, options, selected, compact, onReset, onToggle }: {
  id: string; label: string; allLabel: string; options: { value: string; label: string }[];
  selected: string[]; compact: boolean; onReset: () => void; onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  const summary = options.filter(option => selected.includes(option.value)).map(option => option.label).join(', ') || allLabel;
  return <div className="filter-field" ref={ref} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {!compact && <button className="filter-trigger" ref={trigger} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><span>{label}</span><strong title={summary}>{summary}</strong><Icon name="chevron" size={14} /></button>}
    {(compact || open) && <fieldset id={id}><legend>{label}</legend><div className="filter-options">
      <button aria-pressed={!selected.length} onClick={onReset}>{allLabel}</button>
      {options.map(option => <button key={option.value} aria-pressed={selected.includes(option.value)} onClick={() => onToggle(option.value)}>{option.label}</button>)}
    </div></fieldset>}
  </div>;
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
      <span className="brand-name">{fan.brandLabel[locale]}</span>
      <h2 id="detail-title">{modelName(fan, locale)}</h2>
      <FormFactor fan={fan} locale={locale} />
      <div className="detail-results">{applications.map(key => <div key={key}>
        <span className={'application-label ' + key}><Icon name={key} />{t[key]}</span>
        <strong>{fan.measurements[key].airflowCfm.toFixed(2)} <small>CFM</small></strong>
        <span>{fan.measurements[key].rpm} RPM</span>
      </div>)}</div>
      <p className="detail-condition">{t.testCondition}</p>
      {fan.dedicatedReviewUrl && <div className="detail-links"><ExternalLink href={fan.dedicatedReviewUrl}>{t.dedicatedReview}</ExternalLink></div>}
    </div>}
  </dialog>;
}

export default function App() {
  const [state, setState] = useState<ViewState>(() => readState(location.search, preferredLocale(), fans));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia('(max-width: 640px)').matches);
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
  const showChart = !compactLayout || state.view === 'chart';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const onChange = () => setCompactLayout(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.title = t.siteName;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.description);
    try { localStorage.setItem('fanbench-data-language', state.locale); } catch { /* Storage is optional. */ }
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
    const csv = exportCsv(shown, catalog, state.locale);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'fanbench-data-36dba.csv'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderFanIdentity(fan: Fan) {
    const model = modelName(fan, state.locale);
    return <div className="fan-identity">
      <div className="fan-title-line">
        <input type="checkbox" className="fan-checkbox" aria-label={`${t.select} ${model}`} checked={state.selected.includes(fan.id)} onChange={() => toggleSelection(fan.id)} />
        <div className="fan-name"><span className="brand-name">{fan.brandLabel[state.locale]}</span><button className="model-button" onClick={() => setDetailFan(fan)} aria-label={`${t.details}: ${model}`}>{model}</button></div>
      </div>
      <div className="fan-metadata"><FormFactor fan={fan} locale={state.locale} />
        {fan.dedicatedReviewUrl && <ExternalLink className="review-link" href={fan.dedicatedReviewUrl}>{t.dedicatedReview}</ExternalLink>}
      </div>
    </div>;
  }

  function renderColumnHeading(application: Application) {
    return <button className={`column-sort ${application} ${state.sort === application ? 'is-sorted' : ''}`} onClick={() => sortBy(application)} aria-label={`${t.sortBy}: ${t[application]}`}>
      <span>{t[application]}<span className={state.direction === 'asc' && state.sort === application ? 'sort-arrow reversed' : 'sort-arrow'}><Icon name="down" size={14} /></span></span>
      <small>CFM</small>
    </button>;
  }

  return <>
    <a className="skip-link" href="#comparison">{t.skip}</a>
    <header className="site-header"><div className="header-inner">
      <h1 id="page-title">{t.siteName}</h1>
      <div className="header-actions"><button className="button secondary share-button" onClick={share}><Icon name={shareStatus === 'copied' ? 'check' : 'share'} size={15} />{shareStatus === 'copied' ? t.copied : t.share}</button>
      <div className="language-switch" aria-label="Language / 语言"><button lang="en" aria-pressed={state.locale === 'en'} onClick={() => update({ locale: 'en' })}>EN</button><button lang="zh-Hans" aria-pressed={state.locale === 'zh-Hans'} onClick={() => update({ locale: 'zh-Hans' })}>简中</button></div></div>
    </div></header>
    <main>
      <section id="comparison" className="comparison page-width" aria-labelledby="page-title">
        {shareStatus === 'fallback' && <label className="share-fallback">{t.shareFallback}<input readOnly value={location.href} onFocus={event => event.currentTarget.select()} /></label>}
        <div className="comparison-panel">
          <div className="filter-toolbar">
            <label className="search-field"><Icon name="search" /><input type="search" aria-label={t.search} placeholder={t.search} value={state.query} onChange={event => update({ query: event.target.value })} /></label>
            <div className="toolbar-right"><label className="sort-select"><span>{t.sortBy}</span><select aria-label={t.sortBy} value={state.sort} onChange={event => update({ sort: event.target.value as Application, direction: 'desc' })}>{applications.map(key => <option key={key} value={key}>{t[key]}</option>)}</select></label><button className="icon-button direction-button" aria-label={state.direction === 'desc' ? t.descending : t.ascending} onClick={() => update({ direction: state.direction === 'desc' ? 'asc' : 'desc' })}><span className={state.direction === 'asc' ? 'reversed' : ''}><Icon name="down" /></span></button><div className="view-toggle"><button aria-label={t.chart} aria-pressed={state.view === 'chart'} onClick={() => update({ view: 'chart' })}><Icon name="chart" /></button><button aria-label={t.table} aria-pressed={state.view === 'table'} onClick={() => update({ view: 'table' })}><Icon name="table" /></button></div></div>
            <button className="mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="filter-fields" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" />{t.filters}{activeFilters > 0 && <span className="count-badge">{activeFilters}</span>}<span className="filter-toggle-indicator">{filtersOpen ? '−' : '+'}</span></button>
            <div id="filter-fields" className={'filter-fields' + (filtersOpen ? ' open' : '')}>
              <FilterField id="size-options" label={t.size} allLabel={t.all} compact={compactLayout} options={sizes.map(size => ({ value: String(size), label: `${size} mm` }))} selected={state.sizes} onReset={() => update({ sizes: [] })} onToggle={value => toggleFilter('sizes', value)} />
              <FilterField id="thickness-options" label={t.thickness} allLabel={t.all} compact={compactLayout} options={[...thicknesses.map(value => ({ value: String(value), label: `${value} mm` })), { value: 'unknown', label: t.unknown }]} selected={state.thicknesses} onReset={() => update({ thicknesses: [] })} onToggle={value => toggleFilter('thicknesses', value)} />
              <FilterField id="brand-options" label={t.brand} allLabel={t.all} compact={compactLayout} options={brands.map(([value, label]) => ({ value, label: label[state.locale] }))} selected={state.brands} onReset={() => update({ brands: [] })} onToggle={value => toggleFilter('brands', value)} />
            </div>
            <div className="results-count" role="status">{t.showing} <strong>{shown.length}</strong> {t.of} {fans.length} {t.fans}{hasFilters && <button className="text-button" onClick={resetFilters}>{t.reset}</button>}</div>
          </div>
          {(state.selected.length > 0 || state.onlySelected) && <div className="selection-toolbar"><span><strong>{state.selected.length}</strong> {t.selected}</span><label><input type="checkbox" checked={state.onlySelected} onChange={event => update({ onlySelected: event.target.checked })} />{t.onlySelected}</label><button className="text-button" onClick={() => update({ selected: [], onlySelected: false })}>{t.clearSelection}</button></div>}

          {shown.length === 0 ? <div className="empty-state"><Icon name="search" size={36} /><h3>{t.noResults}</h3><p>{t.noResultsHint}</p><button className="button primary" onClick={resetFilters}>{t.reset}</button></div> : showChart ? <div className="chart-view" role="region" aria-label={t.chart} tabIndex={0}>
            <div className="chart-heading comparison-grid"><div className="fan-column-label">{t.fan} · {t.dimensions}</div>{applications.map(key => <div key={key}>{renderColumnHeading(key)}<ChartAxis /></div>)}</div>
            <div className="fan-rows">{shown.map(fan => <article className={'fan-row comparison-grid' + (state.selected.includes(fan.id) ? ' selected' : '')} key={fan.id} data-fan-id={fan.id} aria-label={`${fan.brandLabel[state.locale]} ${modelName(fan, state.locale)}`}>
              {renderFanIdentity(fan)}
              <div className="mobile-axis" aria-hidden="true"><ChartAxis /><span>CFM</span></div>
              <div className="mobile-measurements">{applications.map(key => <div className={`measurement-cell ${key}`} key={key}>
                <span className="mobile-application">{t[key]}</span>
                <span className="sr-only">{t[key]}: {fan.measurements[key].airflowCfm.toFixed(2)} CFM, {fan.measurements[key].rpm} RPM</span>
                <div className="bar-track" aria-hidden="true" style={{ '--bar-width': `${fan.measurements[key].airflowCfm / scale.maximum * 100}%` } as CSSProperties}>
                  <div className="bar"><span className="rpm">{fan.measurements[key].rpm} RPM</span><strong className="airflow-value">{fan.measurements[key].airflowCfm.toFixed(2)}</strong></div>
                </div>
              </div>)}</div>
            </article>)}</div>
            <div className="chart-bottom comparison-grid" aria-hidden="true"><div />{applications.map(key => <div key={key}><ChartAxis bottom /><div className="axis-title">{t.airflow} (CFM)</div></div>)}</div>
          </div> : <div className="table-scroll" role="region" aria-label={t.table} tabIndex={0}><table><caption className="sr-only">{t.tableCaption}</caption><thead><tr><th scope="col">{t.fan}</th>{applications.map(key => <th scope="col" key={key} aria-sort={state.sort === key ? state.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>{renderColumnHeading(key)}</th>)}</tr></thead><tbody>{shown.map(fan => <tr key={fan.id} className={state.selected.includes(fan.id) ? 'selected' : ''}><th scope="row">{renderFanIdentity(fan)}</th>{applications.map(key => <td key={key}><strong>{fan.measurements[key].airflowCfm.toFixed(2)} <small>CFM</small></strong><span>{fan.measurements[key].rpm} RPM</span></td>)}</tr>)}</tbody></table></div>}
        </div>
        <div className="chart-footnote"><p>{t.testCondition} · {t.higherBetter}<span className="scale-note"> · {t.commonScale}: 0–{scale.maximum} CFM</span></p><button className="text-button download-button" onClick={download}><Icon name="download" size={15} />{t.download}</button></div>
        <details className="test-notes"><summary>{t.methodology}</summary><dl>{applications.map(key => <div key={key}><dt>{t[key]}</dt><dd>{testSetup.fixtures[key][state.locale]}</dd></div>)}</dl><p>{t.contextText}</p></details>
      </section>

    </main>
    <footer className="site-footer page-width"><p>{t.attribution}</p><p className="independent-note">{t.independent}</p></footer>
    <FanDetails fan={detailFan} locale={state.locale} onClose={() => setDetailFan(null)} />
  </>;
}
