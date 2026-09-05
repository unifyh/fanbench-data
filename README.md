# Fan Compare / 风扇对比

A bilingual, independent comparison of PC fan airflow at the same noise level. Measurements are credited to **风向标 FanBench**. This project is not affiliated with or endorsed by FanBench.

基于风向标 FanBench 公开测试数据整理的独立风扇对比网站，与 FanBench 无隶属关系，未经其背书。

## Features

- Case, **Heatsink**, and Radiator results displayed together, sorted by any application.
- Airflow (CFM), RPM, form factor, measurement sources, and known dedicated reviews.
- Multiple size, thickness, and brand filters; bilingual search and shareable shortlists.
- English and Simplified Chinese, desktop columns and mobile cards, accessible data table and CSV export.
- No backend, runtime CDN, external fonts, analytics, embedded videos, or paid service.

## Development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the `/fan-compare/` URL printed by Vite.

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use locally installed Microsoft Edge (desktop and mobile emulation). Install Edge or change the browser channel in `playwright.config.ts` to a supported Playwright browser. The test runner starts a local preview of the built site.

## Data and provenance

The initial dataset is in `src/data/ep037.json`: six fans, 18 operating points at **36 dBA measured 30 cm from the fan intake**, transcribed from [episode 037](https://www.bilibili.com/video/BV1NQti6HErx/). The comparison slide is identified by filename in the data; local reference screenshots are not published in this repository. No video timestamp was available.

Fixture descriptions are retained in both languages. The original comparison precision is preserved, e.g. A140 case airflow is 66.96 CFM, not the rounded 67.0 from the summary slide. The A140 review title includes “FC”; its comparison label is preserved, with the distinction explained in details.

Four thicknesses have sources: the A140 specification slide, Sanyo Denki 9RA1412P1G001 (38 mm), ARCTIC P14 Pro PST (27 mm), and Phanteks T30 140 (30 mm). MACH140 and A120 thicknesses remain `null` rather than guessed; their nominal sizes are inferred from their model names and marked in details. Do not treat missing dedicated-review links as evidence that a video does not exist.

When adding data:

1. Identify the precise model, variant, episode, source, and test conditions.
2. Transcribe all three CFM/RPM pairs, preserving the displayed precision, and check against the source.
3. Verify dimensions independently. Leave unknown values explicit and explain inferred values.
4. Add a dedicated review only when it actually reviews that model.
5. Keep incompatible noise targets, measurement distances, fixtures, or protocol revisions in separate comparison datasets. The current UI intentionally loads only EP037.
6. Run data tests and a production build.

These are simulated-restriction airflow measurements, not CPU temperature measurements. No interpolation, extrapolation, combined score, or arbitrary noise slider is used. Equal dBA does not guarantee the same sound character.

## Hosting

GitHub Pages can host this static build for free from a public repository. The included workflow tests and builds on pushes to `main`, then deploys `dist/`. Configure the repository **Settings → Pages → Source** to **GitHub Actions**.

Default base path: `/fan-compare/`. Override `BASE_PATH=/` when building for a root/custom-domain deployment. All runtime assets are served from the same host; the same `dist` build can be served by any static host using the matching base path. Mainland China availability is best effort and has not been independently verified.

## Attribution

All testing credit belongs to [风向标 FanBench](https://space.bilibili.com/3546883662284811/upload/video). The site uses original layout and chart styling. Screenshots, reviewer logos, photos, and video/audio are not redistributed.
