# Maxframe

![CI](https://github.com/joaobispo2077/maxframe/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/joaobispo2077/maxframe/actions/workflows/release.yml/badge.svg)
![Maxframe Logo](.github/assets/maxframe-logo.png)

Electron + React + TypeScript desktop app for transparent, high-quality video downloads.

## yt-dlp and ffmpeg: packaged app vs local development

Behavior differs on purpose: **production builds** ship binaries next to the app; **`npm start`** does not.

### Packaged app (installer, portable, or `dist/win-unpacked/…`)

[electron-builder.mjs](electron-builder.mjs) copies **`buildResources/yt-dlp/`** and **`buildResources/ffmpeg/`** into the app as **`resources/yt-dlp/`** and **`resources/ffmpeg/`** (see `extraResources` there). At runtime, [resolveYtdlpExecutable](src/infrastructure/youtube/resolveYtdlpExecutable.ts) and [resolveFfmpegExecutable](src/infrastructure/ffmpeg/resolveFfmpegExecutable.ts) prefer those folders when Electron exposes `process.resourcesPath`.

**End users who install a build that was compiled with real binaries in those folders do not need a separate yt-dlp or ffmpeg install** — Maxframe resolves them from inside the package.

If a compile was run **without** placing `yt-dlp.exe` / `ffmpeg.exe` (or non-Windows equivalents) in those `buildResources` folders, the packaged app still falls back to **`PATH`** or **`YT_DLP_PATH`** / **`FFMPEG_PATH`** (see [buildResources/yt-dlp/README.txt](buildResources/yt-dlp/README.txt) and [buildResources/ffmpeg/README.txt](buildResources/ffmpeg/README.txt)).

### Local development (`npm start`)

Dev runs Electron from the repo **without** the packaged `resources/` layout from `electron-builder`. There is **no** bundled copy of yt-dlp/ffmpeg unless you point the app at one yourself.

For real analyze/download on your machine you still need:

- **yt-dlp** — on `PATH`, or **`YT_DLP_PATH`** set to the binary ([releases](https://github.com/yt-dlp/yt-dlp/releases)).
- **ffmpeg** — on `PATH`, or **`FFMPEG_PATH`** set, especially for **video-only** downloads that merge audio ([ffmpeg.org](https://ffmpeg.org/download.html)).

### Tests and CI

- **Tests / CI without yt-dlp** — Set **`MAXFRAME_FAKE_VIDEO_METADATA=1`** so analyze uses deterministic in-memory metadata (default for the `unit-tests` job in `.github/workflows/ci.yml`).
- **Optional real-tool smoke** — Use the manual workflow [yt-dlp smoke](.github/workflows/yt-dlp-smoke.yml) (`workflow_dispatch`) when you want a maintainer-only check with network and upstream binaries (not part of default PR CI).

## CI Workflows

GitHub Actions workflows include:

- `CI` (`.github/workflows/ci.yml`)
  - Runs on `push` for lower environments: `feature/**`, `dev`, `release`
  - Runs on `pull_request` targeting `release`, `main`
  - Jobs:
    - `typecheck`
    - `unit-tests` (coverage summary generated and posted as sticky PR comment)
    - `e2e-tests` (Cypress component mode via `cypress-io/github-action@v7`; only for `dev -> release` and `release -> main` PRs)
    - `mutation-tests` (Stryker **PR fast profile** on promotion PRs; `ignoreStatic` + InMemory gateway excluded; **incremental** + Actions cache on `reports/stryker-incremental.pr.json`. Strict local/weekly: `npm run test:mutation` or `stryker-full.yml`. [Incremental docs](https://stryker-mutator.io/docs/stryker-js/incremental/).)
- `Stryker full` (`.github/workflows/stryker-full.yml`) — weekly and manual **non-incremental** mutation run on `ubuntu-latest` (mitigates incremental drift after dependency-only changes).
- `Release` (`.github/workflows/release.yml`)
  - **Windows (phase 1):** the pipeline is **gated** — `build-windows` (NSIS on `windows-latest`) → `smoke-windows` (silent install + launch) → `release` (semantic-release on `ubuntu-latest`). A push to `release` (or `workflow_dispatch`) will **not** publish a GitHub release if the Windows build or smoke job fails. macOS and Linux packaged builds are not part of this workflow yet.
  - The **Windows** `*-win-x64.exe` from the build is downloaded on the `release` job and attached to the same GitHub Release as the changelog; see [docs/releasing-windows.md](docs/releasing-windows.md) for artifacts, NSIS flags, and **unsigned** binary notes.
  - Uses [semantic-release](https://github.com/semantic-release/semantic-release) on the **`release`** branch with `release.config.mjs` (changelog, GitHub release, no npm publish, git-committed version bump).
  - Requires a repository secret **`GH_TOKEN`**: a fine-grained or classic PAT with permission to push to `release`, create releases, and bypass branch protection if your rules block bot pushes (semantic-release commits `CHANGELOG.md`, `package.json`, and `package-lock.json`). The `release` job sets both `GH_TOKEN` and `GITHUB_TOKEN` to this value for GitHub API access.

## GitFlow Branch Model

Promotion flow:

`feature/* -> dev -> release -> main`

- `main`: production branch
- `release`: UAT branch and release tag source
- `dev`: stable integration branch
- `feature/*`: feature development branches

### Required checks (recommended branch protection)

Recommended required checks:

- `Typecheck`
- `Unit Tests`
- `E2E Tests (Cypress Component)` for:
  - `dev -> release`
  - `release -> main`

## Local Commands (same as CI)

Use **Node.js 24.10+** locally (required by **semantic-release v25** and matched in GitHub Actions).

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:mutation` (strict full baseline — all `src/**`, static mutants run)
- `npm run test:mutation:incremental` (strict incremental; cache: `reports/stryker-incremental.json`)
- `npm run test:mutation:pr` (PR fast profile — mirrors promotion PR CI)
- `npm run test:mutation:pr:incremental` (PR fast incremental; cache: `reports/stryker-incremental.pr.json`)
- `npm run lint`
- `npm run release:local` (local semantic-release with `--no-ci`; CI uses `npm run release`)

## Troubleshooting CI

- If Cypress fails due to environment dependencies, confirm Linux packages in `ci.yml` match your Cypress/Electron version.
- If the release workflow fails, confirm `GH_TOKEN` is set and has sufficient scope, and that commits on `release` follow [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can infer the next version.
- If peer dependency conflicts appear in CI install, check lockfile consistency before merges.
