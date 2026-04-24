# Plan: video-pipeline (yt-dlp)

**Task ID:** video-pipeline  
**Status:** Active

## Goal

Ship a reliable **analyze + download** path using **yt-dlp**, with sensible binary resolution for dev, CI, and packaged installs, **ffmpeg** available before merge downloads, and a **Chakra-first** dark UI shell (no Tailwind in this iteration).

## Approach

1. **Binary resolution (yt-dlp)** — `YT_DLP_PATH` → bundled `extraResources` layout under `process.resourcesPath` → `PATH` (`yt-dlp`).
2. **Binary resolution (ffmpeg)** — `FFMPEG_PATH` → optional bundled layout under `process.resourcesPath` (same pattern as yt-dlp) → `PATH` (`ffmpeg`). Probe with `ffmpeg -version` before merge-style downloads.
3. **Packaging** — `electron-builder` copies optional yt-dlp binaries from `buildResources/yt-dlp/` into app `resources/` (documented; not committed). Optional ffmpeg drop can mirror this later.
4. **Output path** — After yt-dlp, resolve the saved file with `findYtdlpOutputFile` (known extensions + safe directory scan); return only paths that exist or throw a clear “file not found” message.
5. **Presentation** — `createSystem(defaultConfig, …)` in `maxframeTheme.ts`; `App.tsx` uses Chakra layout primitives; global gradient/chrome in theme `globalCss`.
6. **Spec alignment** — `spec.md` tracks download, ffmpeg, cookies (out of v1), and UI direction.

## Out of scope (this iteration)

- Download progress IPC / cancel token.
- Automatic CI download of yt-dlp per arch (manual copy or release pipeline add-on); default PR CI stays on `MAXFRAME_FAKE_VIDEO_METADATA=1` for unit tests.
- Netscape cookies / age-gate import for yt-dlp (deferred; documented in `spec.md`).
