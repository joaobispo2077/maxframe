# Todo: video-pipeline

| # | Task | Status |
|---|------|--------|
| 1 | Align `resolveYtdlpExecutable` with `extraResources` folder `resources/yt-dlp/` | [x] |
| 2 | Add `extraResources` in `electron-builder.mjs` + `buildResources/yt-dlp` instructions | [x] |
| 3 | Extend unit tests for bundled path resolution | [x] (skipped ESM `existsSync` spy; covered by layout + manual/packaged smoke) |
| 4 | Update `spec.md` revision (download + bundle) | [x] |
| 5 | Run `typecheck` + `test:unit` | [x] |
| 6 | Phase 1.1: explainer + copy | [x] |
| 7 | Phase 1.2: row labels, bitrates, best badge | [x] |
| 8 | Phase 1.3: hover/focus vs-best line + `qualityTransparency` tests | [x] |
| 9 | ffmpeg probe + `FFMPEG_PATH` / `findYtdlpOutputFile` | [x] |
| 10 | Chakra shell + `maxframeTheme`; README first run; CI fake metadata; optional smoke workflow | [x] |
| 11 | Optional ffmpeg bundle (`buildResources/ffmpeg`, `extraResources`, gitignore) | [x] |
| 12 | Add mutation-focused tests for default gateway branching + progress log hook behavior | [x] |
| 13 | Add component coverage for `HomePage` interactions (Enter download, cancel flow) and rerun mutation suite | [x] |
| 14 | Add mutation-focused tests for yt-dlp download/gateway error paths and ffmpeg resolution/probe branches | [x] |
| 15 | Rerun incremental mutation cycles and record score trajectory toward 84 target | [x] (43.29 -> 53.18 -> 54.69 -> 57.01) |

## Progress log

| Date | Note |
|------|------|
| 2026-04-24 | Plan/todo created; implementing bundle layout + spec sync. |
| 2026-04-24 | `extraResources`, `resolveYtdlpExecutable` subfolder, README, gitignore, spec v0.2.0, tests. |
| 2026-04-24 | UI transparency: explainer, bitrates, Ranked #1 badge, compare line; `qualityTransparency.ts` + tests. |
| 2026-04-24 | Phases 2–4: ffmpeg preflight, output resolution, a11y/UX, Cypress download; Chakra theme + spec v0.5.0. |
| 2026-04-24 | Optional ffmpeg `extraResources` + `buildResources/ffmpeg/README.txt`; spec v0.5.1. |
| 2026-04-25 | Mutation-score hardening: added tests for `useDownloadProgressLog`, `analyzeVideoHandler` default gateway branch selection, direct `HomePage` interaction paths, and theme token assertions; mutation score moved above break threshold. |
| 2026-04-25 | Added new mutation-killing tests for `runYtdlpDownload`, `YtdlpVideoMetadataGateway`, `ytdlpDownloadNeedsFfmpeg`, `resolveFfmpegExecutable` bundled candidates, and ffmpeg probe options/error branches; score increased to 57.01. |
