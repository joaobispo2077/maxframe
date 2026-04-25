# Maxframe

![CI](https://github.com/joaobispo2077/maxframe/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/joaobispo2077/maxframe/actions/workflows/release.yml/badge.svg)
![Maxframe Logo](.github/assets/maxframe-logo.png)

Electron + React + TypeScript desktop app for transparent, high-quality video downloads.

## First run (analyze + download)

- **yt-dlp** — Required for real metadata and downloads. Install a release from [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) and ensure `yt-dlp` is on your `PATH`, or set **`YT_DLP_PATH`** to the binary. Packaged builds can drop an executable under `buildResources/yt-dlp/` (see `buildResources/yt-dlp/README.txt`); the app also checks `resources/yt-dlp/` at runtime.
- **ffmpeg** — Required when you download a **video-only** row (yt-dlp merges best audio). Install from [ffmpeg.org](https://ffmpeg.org/download.html) and keep `ffmpeg` on your `PATH`, or set **`FFMPEG_PATH`**. For packaged builds you can drop `ffmpeg` / `ffmpeg.exe` under `buildResources/ffmpeg/` (see `buildResources/ffmpeg/README.txt`); the app checks `resources/ffmpeg/` at runtime.
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
    - `mutation-tests` (Stryker on promotion PRs; **incremental** + Actions cache on `reports/stryker-incremental.json`. Full local/forced: `npm run test:mutation` or `stryker run --force`. [Incremental docs](https://stryker-mutator.io/docs/stryker-js/incremental/). Weekly full run: `stryker-full.yml`.)
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
- `npm run test:mutation` (full baseline)
- `npm run test:mutation:incremental` (reuse `reports/stryker-incremental.json` when present)
- `npm run lint`
- `npm run release:local` (local semantic-release with `--no-ci`; CI uses `npm run release`)

## Troubleshooting CI

- If Cypress fails due to environment dependencies, confirm Linux packages in `ci.yml` match your Cypress/Electron version.
- If the release workflow fails, confirm `GH_TOKEN` is set and has sufficient scope, and that commits on `release` follow [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can infer the next version.
- If peer dependency conflicts appear in CI install, check lockfile consistency before merges.
