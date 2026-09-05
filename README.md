# FanBench Data Archive / 风向标测试数据汇总

A bilingual, unofficial archive of test data published by **风向标 FanBench**, with PC fan airflow comparisons at the same noise level. The collection and site are unofficial; all measurements come from FanBench’s published tests. This project is not affiliated with FanBench.

非官方数据汇总站，数据来自风向标公开测试，与风向标无隶属关系。

## Features

- Case, **Heatsink**, and Radiator results displayed together, sorted by the column headings on desktop. Mobile retains the sort and view controls.
- Airflow (CFM), RPM, form factor, and known dedicated review links. Source metadata is retained in the dataset.
- Solid green bars with RPM inside and CFM at the end; compact rows and sticky desktop axes. The shared scale covers the entire catalog and stays fixed while filtering or sorting.
- Multiple size, thickness, and brand filters; bilingual search and shareable shortlists.
- English and Simplified Chinese, with localized brand and product names (English fallback) in the UI and CSV export; desktop columns, mobile cards, and an accessible data table.
- No backend, runtime CDN, external fonts, analytics, embedded videos, or paid service.

## Episode coverage

- [FanBench - 037 | 酷冷至尊 MASTERFAN A140 FC 性能测试报告](https://www.bilibili.com/video/BV1NQti6HErx/)
- [FanBench - 036 | 睿温 R25 LCP PRO 性能测试报告](https://www.bilibili.com/video/BV15gtc6YEuu/)
- [FanBench - 035 | 攀威 LF12 2200 性能测试报告](https://www.bilibili.com/video/BV1PJ8E6MEb4/)

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

## Hosting

The site is hosted on [GitHub Pages](https://unifyh.github.io/fanbench-data/) from this public repository, using the free default GitHub Pages domain.

Deployments are manual: in **Actions → Deploy to GitHub Pages → Run workflow**, select `main`. GitHub Pages uses **GitHub Actions** as its source. Pushes and pull request merges do not deploy automatically.

Default base path: `/fanbench-data/`. Override `BASE_PATH=/` when building for a root/custom-domain deployment. All runtime assets are served from the same host; the same `dist` build can be served by any static host using the matching base path. Mainland China availability is best effort and has not been independently verified.

## Attribution

All testing credit belongs to [风向标 FanBench](https://space.bilibili.com/3546883662284811/upload/video). The site uses original layout and chart styling. Screenshots, reviewer logos, photos, and video/audio are not redistributed.
