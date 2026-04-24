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
  - Runs on semantic tags: `v*.*.*`
  - Validates semantic tag format
  - Verifies tag commit is from `release` branch
  - Runs release checks and drafts a GitHub release

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

## Troubleshooting CI

- If Cypress fails due to environment dependencies, confirm Linux packages in `ci.yml` match your Cypress/Electron version.
- If release tagging fails, confirm your tag uses semantic format (`v1.2.3`) and was created from a commit reachable from `release`.
- If peer dependency conflicts appear in CI install, check lockfile consistency before merges.
