# FanBench Data Archive / 风向标测试数据汇总

A bilingual, unofficial archive of test data published by **风向标 FanBench**, with PC fan airflow comparisons at the same noise level. The collection and site are unofficial; all measurements come from FanBench’s published tests. This project is not affiliated with FanBench.

非官方数据汇总站，数据来自风向标公开测试，与风向标无隶属关系。

## Features

- Case, **Heatsink**, and Radiator results displayed together, sorted by the column headings on desktop. Mobile retains the sort and view controls.
- Airflow (CFM), RPM, form factor, and known dedicated review links. Source metadata is retained in the dataset.
- Solid green bars with RPM inside and CFM at the end; compact rows and sticky desktop axes. The shared scale covers the entire catalog and stays fixed while filtering or sorting.
- Multiple size, thickness, and brand filters; bilingual search and shareable shortlists.
- English and Simplified Chinese, desktop columns and mobile cards, accessible data table and CSV export.
- No backend, runtime CDN, external fonts, analytics, embedded videos, or paid service.

## Development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the `/fanbench-data/` URL printed by Vite.

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use locally installed Microsoft Edge (desktop and mobile emulation). Install Edge or change the browser channel in `playwright.config.ts` to a supported Playwright browser. The test runner starts a local preview of the built site.

## Data and provenance

Fan data lives in **`src/data/fans/<fan-id>.json`**, one file per fan. The initial six fans contain 18 operating points transcribed from [episode 037](https://www.bilibili.com/video/BV1NQti6HErx/). Local screenshot filenames are not stored.

`src/data/catalog.json` stores the shared **36 dBA at 30 cm from the intake** condition, test fixture definitions, and episode/video references. The noise condition applies across episodes. Episodes are sources, not the primary data records.

Each fan has a `results` array and an explicit `comparisonResultId` selecting the result shown on the chart. A result contains all three CFM/RPM pairs and a `sources` array referencing any episodes where it appears. Repeated appearances of unchanged results add a source to that same result; a retest or correction adds a new result. Adding an episode does not duplicate a fan or automatically replace its measurements. The source list belongs to the result, so CSV exports keep the provenance of the displayed values.

Fixture descriptions are retained in both languages. The original comparison precision is preserved, e.g. A140 case airflow is 66.96 CFM, not the rounded 67.0 from the summary slide. Model names follow the comparison labels.

Dimensions are stored in millimeters, with unknown thickness represented by `null`. Do not treat missing dedicated-review links as evidence that a video does not exist.

When adding data:

1. Find the fan by its stable ID, or add a new fan file for a different model or variant. Add the episode/video reference to the catalog.
2. If the episode repeats existing results, append its reference to that result. Otherwise add a result with all three CFM/RPM pairs, preserving the displayed precision, and check against the source.
3. Verify dimensions and leave unknown values explicit.
4. Add a dedicated review only when it actually reviews that model.
5. Select the result to display with `comparisonResultId`. Test fixtures must match the catalog comparison setup; equal noise alone does not establish fixture compatibility. Retain older results.
6. Run data tests and a production build.

These are simulated-restriction airflow measurements, not CPU temperature measurements. No interpolation, extrapolation, combined score, or arbitrary noise slider is used. Equal dBA does not guarantee the same sound character.

## Hosting

Publishing requires an explicit user request. Keep representation changes local: do not push, deploy, enable Pages, or change repository visibility without that request. The repository is private and Pages and its deployment workflow are disabled.

GitHub Pages can host this static build for free from a public repository. The included workflow runs only when manually dispatched; pushes do not deploy. If publication is explicitly requested, configure **Settings → Pages → Source** to **GitHub Actions**, enable the workflow, and dispatch it.

Default base path: `/fanbench-data/`. Override `BASE_PATH=/` when building for a root/custom-domain deployment. All runtime assets are served from the same host; the same `dist` build can be served by any static host using the matching base path. Mainland China availability is best effort and has not been independently verified.

## Attribution

All testing credit belongs to [风向标 FanBench](https://space.bilibili.com/3546883662284811/upload/video). The site uses original layout and chart styling. Screenshots, reviewer logos, photos, and video/audio are not redistributed.
