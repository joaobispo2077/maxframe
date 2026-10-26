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
- **Packaged GUI test hook** — `MAXFRAME_E2E=1` plus `MAXFRAME_E2E_FIXTURE` points analyze and download at a local file. See [docs/e2e-ac15-test-hooks.md](docs/e2e-ac15-test-hooks.md). A fixture path without test mode does nothing.
- **Optional real-tool smoke** — Use the manual workflow [yt-dlp smoke](.github/workflows/yt-dlp-smoke.yml) (`workflow_dispatch`) when you want a maintainer-only check with network and upstream binaries (not part of default PR CI).

## CI Workflows

GitHub Actions workflows include:

- `CI` (`.github/workflows/ci.yml`)
  - Runs on `push` for `release` and `feature/**`. It does not run on a push to `develop` or `main`.
  - A `feature/**` push runs full CI, including a check named `CI readiness`, when no open mergeable pull request validates that commit. When one does, `select-run` sets `run_full_ci` to false, the gate jobs are skipped, and the readiness job is renamed to `CI readiness (push skipped, PR validates)`. That push does not report a check named `CI readiness`.
  - Runs on `pull_request` targeting `main`, `develop`, and `release`. That run always executes the gates. Its check named `CI readiness` is the one branch protection should require. A skipped or missing gate on that run fails `CI readiness`.
  - Required jobs are not filtered by head or base branch. `ci-readiness` uses `if: always()` and, except for the renamed push suppression above, fails unless every required job is `success` and uploaded a passing `gate.json`. Skipped, cancelled, failed, and missing `gate.json` are red on a pull request. No required job is an intentional path-filter skip. See [Quality gates](docs/maxframe-quality-gates.md).
  - Jobs:
    - `typecheck`
    - `lint` (`npm run lint`)
    - `format` (`npm run format:check`)
    - `unit-tests` (Vitest coverage summary is printed in the job log and copied into `gate.json`. The old coverage sticky is folded into `maxframe quality`.)
    - `e2e-tests` (Cypress component mode via `cypress-io/github-action@v7`)
    - `mutation-tests` (Stryker **PR fast profile**; `ignoreStatic` + InMemory gateway excluded; incremental cache restores only on an exact key, with no prefix `restore-keys`. A non-exact restore does not count as a score. Strict local/weekly: `npm run test:mutation` or `stryker-full.yml`. [Incremental docs](https://stryker-mutator.io/docs/stryker-js/incremental/).)
    - `scheduled-workflow` (warns when the Stryker full workflow is not active)
    - `ci-readiness` (writes `reports/quality/ci-readiness.json`, renders the `maxframe quality` sticky from that file with header `maxframe-quality`, and uploads the `ci-readiness` artifact. Push events and fork PRs still write the JSON and the job summary. The comment is posted only for pull requests from this repository.)
- `Stryker full` (`.github/workflows/stryker-full.yml`): weekly cron and `workflow_dispatch`. Non-incremental mutation run on `ubuntu-latest` (mitigates incremental drift after dependency-only changes).
- `Release` (`.github/workflows/release.yml`)
  - **Windows (phase 1):** the pipeline is **gated** — `build-windows` (NSIS on `windows-latest`) → `smoke-windows` (silent install + launch) → `release` (semantic-release on `ubuntu-latest`). A push to `release` (or `workflow_dispatch`) will **not** publish a GitHub release if the Windows build or smoke job fails. macOS and Linux packaged builds are not part of this workflow yet.
  - The **Windows** `*-win-x64.exe` from the build is downloaded on the `release` job and attached to the same GitHub Release as the changelog; see [docs/releasing-windows.md](docs/releasing-windows.md) for artifacts, NSIS flags, and **unsigned** binary notes.
  - Uses [semantic-release](https://github.com/semantic-release/semantic-release) on the **`release`** branch with `release.config.mjs` (changelog, GitHub release, no npm publish, git-committed version bump).
  - Publish checks out `github.sha` and runs `scripts/ci/require-release-ci-readiness.mjs` immediately before `npm run release`. The script requires exactly one merged pull request into `release` for that commit. For a merge commit, `merge_commit_sha` must match and the pull request head must be the second parent. The exact `CI readiness` check from the `pull_request` run of `.github/workflows/ci.yml` must have succeeded on that head. A fast-forward is allowed only when the pull request head is `github.sha`, so the same check is read on that commit. A push check does not count, including `CI readiness (push skipped, PR validates)`. No pull request, more than one pull request, a parent mismatch, a non-success conclusion, and an API error fail the job. A missing or still pending check is polled for 20 minutes, then fails. The highest check run id is the attempt that counts: a later success replaces an earlier failure, and a later failure replaces an earlier success. If the remote `release` tip is not `github.sha`, the job aborts and does not publish. That tip read happens once, immediately before `npm run release`. A push after the read and before semantic-release pushes can still move `release`. semantic-release compares tips only when its auth dry-run push fails. `workflow_dispatch` uses the same gate. The Release job does not set `CI_READINESS_SKIP_RELEASE_TIP_CHECK`.
  - `Release gate dry run` (`.github/workflows/release-gate-dry-run.yml`) runs on pull requests. It must allow `4f62c8929d088883dae7508434dc14182169e7f7` (#134, head `9f0b3ac`) and refuse `e4542f7500324a76972f7204f4a98a3f78f48e54` (#132, head `056307b`, v1.9.1, Release run 40240429715). The green step sets `CI_READINESS_SKIP_RELEASE_TIP_CHECK=1`, so it does not depend on the current `release` tip. The red step does not set that variable. Its refusal is the failed readiness check, which happens before any tip read. It does not publish.
  - Requires a repository secret **`GH_TOKEN`**: a fine-grained or classic PAT with permission to push to `release`, create releases, and bypass branch protection if your rules block bot pushes (semantic-release commits `CHANGELOG.md`, `package.json`, and `package-lock.json`). The `release` job sets both `GH_TOKEN` and `GITHUB_TOKEN` to this value for GitHub API access.

## GitFlow Branch Model

Promotion flow:

`feature/* -> develop -> release -> main`

- `main`: production branch
- `release`: UAT branch and release tag source
- `develop`: stable integration branch
- `feature/*`: feature development branches

### Required checks (recommended branch protection)

Recommended required checks:

- `Typecheck`
- `Lint`
- `Format`
- `Unit Tests`
- `E2E Tests (Cypress Component)`
- `Mutation Tests (Stryker)`
- `Scheduled workflow state`
- `CI readiness` on `release` and `main` after merge (branch protection is a manual step)

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
