# Maxframe

![CI](https://github.com/joaobispo2077/maxframe/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/joaobispo2077/maxframe/actions/workflows/release.yml/badge.svg)
![Maxframe Logo](.github/assets/maxframe-logo.png)

Electron + React + TypeScript desktop app for transparent, high-quality video downloads.

## CI Workflows

Two GitHub Actions workflows are configured:

- `CI` (`.github/workflows/ci.yml`)
  - Runs on `push` for lower environments: `feature/**`, `dev`, `release`
  - Runs on `pull_request` targeting `release`, `main`
  - Jobs:
    - `typecheck`
    - `unit-tests` (coverage summary generated and posted as sticky PR comment)
    - `e2e-tests` (Cypress component mode via `cypress-io/github-action@v7`; only for `dev -> release` and `release -> main` PRs)
    - `mutation-tests` (Stryker mutation testing for promotion PRs only)
- `Release` (`.github/workflows/release.yml`)
  - Runs on every push to the `release` branch (and manual `workflow_dispatch`), matching the [semantic-release on `release` pattern](https://github.com/joaobispo2077/joaobispo2077.com/blob/main/.github/workflows/release.yml) used in [joaobispo2077.com](https://github.com/joaobispo2077/joaobispo2077.com).
  - Uses [semantic-release](https://github.com/semantic-release/semantic-release) with `release.config.mjs` (same plugin stack as [`.releaserc.js` there](https://github.com/joaobispo2077/joaobispo2077.com/blob/main/.releaserc.js): changelog, GitHub release, no npm publish, git-committed version bump).
  - Requires a repository secret **`GH_TOKEN`**: a fine-grained or classic PAT with permission to push to `release`, create releases, and bypass branch protection if your rules block bot pushes (semantic-release commits `CHANGELOG.md`, `package.json`, and `package-lock.json`).

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

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:mutation`
- `npm run lint`
- `npm run release:local` (local semantic-release with `--no-ci`; CI uses `npm run release`)

## Troubleshooting CI

- If Cypress fails due to environment dependencies, confirm Linux packages in `ci.yml` match your Cypress/Electron version.
- If the release workflow fails, confirm `GH_TOKEN` is set and has sufficient scope, and that commits on `release` follow [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can infer the next version.
- If peer dependency conflicts appear in CI install, check lockfile consistency before merges.
