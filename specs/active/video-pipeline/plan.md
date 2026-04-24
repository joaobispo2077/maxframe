# Plan: video-pipeline (yt-dlp)

**Task ID:** video-pipeline  
**Status:** Active

## Goal

Ship a reliable **analyze + download** path using **yt-dlp**, with sensible binary resolution for dev, CI, and packaged installs.

## Approach

1. **Binary resolution** — `YT_DLP_PATH` → bundled `extraResources` layout under `process.resourcesPath` → `PATH` (`yt-dlp`).
2. **Packaging** — `electron-builder` copies optional binaries from `buildResources/yt-dlp/` into app `resources/` (documented; not committed).
3. **Spec alignment** — Update `spec.md` so implemented download + bundling hooks are reflected.

## Out of scope (this iteration)

- Download progress IPC / cancel token.
- Automatic CI download of yt-dlp per arch (manual copy or release pipeline add-on).
