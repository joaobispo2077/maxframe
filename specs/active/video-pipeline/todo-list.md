# Todo: video-pipeline

| # | Task | Status |
|---|------|--------|
| 1 | Align `resolveYtdlpExecutable` with `extraResources` folder `resources/yt-dlp/` | [x] |
| 2 | Add `extraResources` in `electron-builder.mjs` + `buildResources/yt-dlp` instructions | [x] |
| 3 | Extend unit tests for bundled path resolution | [x] (skipped ESM `existsSync` spy; covered by layout + manual/packaged smoke) |
| 4 | Update `spec.md` revision (download + bundle) | [x] |
| 5 | Run `typecheck` + `test:unit` | [x] |
| 6 | Phase 1.1: explainer `<details>` + copy | [x] |
| 7 | Phase 1.2: row labels, bitrates, best badge + styles | [x] |
| 8 | Phase 1.3: hover/focus vs-best line + `qualityTransparency` tests | [x] |

## Progress log

| Date | Note |
|------|------|
| 2026-04-24 | Plan/todo created; implementing bundle layout + spec sync. |
| 2026-04-24 | `extraResources`, `resolveYtdlpExecutable` subfolder, README, gitignore, spec v0.2.0, tests. |
| 2026-04-24 | UI transparency: explainer, bitrates, Ranked #1 badge, compare line; `qualityTransparency.ts` + tests. |
