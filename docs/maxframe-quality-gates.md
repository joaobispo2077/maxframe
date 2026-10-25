# Maxframe quality gates

Every gate in `.github/workflows/ci.yml` blocks. A missing report or summary is `UNKNOWN` and blocks. `CI readiness` fails when any required job is failed, skipped, cancelled, or `UNKNOWN`.

Floors live in `scripts/ci/quality-floors.mjs`. Vitest imports the coverage minimums. `stryker.config.base.mjs` imports the mutation break. Do not copy those numbers into a second file.

## Gates

| Gate                     | What it checks                                                                                                                                                                         | Floor                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck                | `tsc` via workspace typecheck                                                                                                                                                          | 0 errors                                                                                                                       |
| Lint                     | ESLint                                                                                                                                                                                 | 0 errors, warnings at or under the existing warning baseline                                                                   |
| Format                   | Prettier                                                                                                                                                                               | 0 files to change                                                                                                              |
| Unit tests               | Vitest                                                                                                                                                                                 | tests pass                                                                                                                     |
| E2E tests                | Cypress component tests                                                                                                                                                                | tests pass                                                                                                                     |
| Coverage                 | Vitest v8 `coverage-summary.json` for application source loaded by the unit tests. `scripts/**` is excluded so the gate measures the app, not the gate scripts.                        | statements 74, branches 63, functions 81, lines 75                                                                             |
| CRAP / complexity        | ESLint modified complexity per function, joined with `coverage-final.json`. CRAP is `complexity^2 * (1 - coverage)^3 + complexity`.                                                    | complexity at most 12, CRAP at most 30, and no new function over that line                                                     |
| Duplication              | jscpd on `src` and the package `src` trees                                                                                                                                             | at most 2% duplicated lines                                                                                                    |
| Dead code                | knip                                                                                                                                                                                   | 0 findings that are not on `scripts/ci/deadcode-allowlist.json`                                                                |
| Architecture             | dependency-cruiser                                                                                                                                                                     | 0 violations. Domain does not import infrastructure. Renderer does not import main. Renderer source does not import Node core. |
| Dependency audit         | `npm audit --json`                                                                                                                                                                     | 0 critical, and at most 40 high                                                                                                |
| Dependency tree          | Package names in `package-lock.json` resolved at more than one version. This is the dedupe check for the npm find-dupes row. `npm find-dupes` needs an installed `node_modules` tree.  | at most 134 packages                                                                                                           |
| Electron security        | `webPreferences` on every `BrowserWindow` under main, preload, and renderer source                                                                                                     | `contextIsolation` true, `nodeIntegration` false, `sandbox` true                                                               |
| Mutation tests           | Stryker on changed `src/**/*.ts`. Tests, Stryker and Vitest config, and the mutation floor and gate scripts run the full PR mutate set. INFO only when the diff touches none of those. | break 68                                                                                                                       |
| Scheduled workflow state | `stryker-full.yml` is readable and active                                                                                                                                              | workflow state is readable and not disabled                                                                                    |

`size-limit` stays a signal. It is not one of these blocking gates.

## How a result is chosen

- `PASS`: the report exists and the measured value meets the floor.
- `FAIL`: the report exists and the measured value misses the floor, or the job was skipped or cancelled.
- `UNKNOWN`: the report or the counts are missing. This is not a pass.

The Software metrics sticky (`quality-gates-report`) has one row per wired gate: value, floor, result (`PASS`, `FAIL`, `UNKNOWN`, or `INFO`), and a link to that row's artifact or job. Each `gate-<job>` artifact contains `gate.json` plus the file whose raw bytes are that row's SHA-256. The same sticky is updated in place on later runs. Planned gates that have no job yet are listed as `Not wired yet` and do not change Overall. Windows build smoke, bundled binaries, and accessibility (cypress-axe) are still not wired. The header states how many gates are wired, the pull request and base, evidence completeness, and a one-line summary. Executed test counts (passed, failed, skipped) come from the Vitest and Cypress receipts on `gate.json`. Its overall matches `CI readiness`, and the chart overall token matches that same overall. The gate status chart counts the wired rows only. PNG files are uploaded as the `quality-charts` artifact and are not embedded in the comment, because a relative `charts/*.png` path does not render on GitHub.

The Mutation tests sticky (`mutation-report`) shows the score, killed, survived, timeout, no coverage, tested this run, cached, the floor, and a link to the HTML report artifact from the same run attempt. Its overall is the mutation row only. INFO is allowed only when the diff touches none of the mutate set (`src/**/*.ts`, excluding the in-memory gateway), `tests`, the Stryker and Vitest configs, `package.json`, `package-lock.json`, or the mutation floor and gate scripts (`quality-floors.mjs`, `mutation-scope.mjs`, `gate-metrics.mjs`, `check-ci-readiness.mjs`, `write-gate-json.mjs`, `accept-stryker-cache.mjs`). The diff uses `--no-renames`, so a move keeps the old path and a relevant file moved out of that set still runs mutation. The row text is `no mutable source changed`. That row does not block. A tests-only or config-only diff runs the PR mutate set without the incremental cache and compares the score with break 68. A source-only diff runs incremental on the changed files. If the diff cannot be computed, the row is FAIL. If mutated source changed and this run tested 0 mutants, the row is FAIL, because that score is cache-only. Any other measured score is compared with break 68.

## Mutation floor

Stryker full run [39808689775](https://github.com/joaobispo2077/maxframe/actions/runs/39808689775) on `develop` at `2318f38b` tested all 1391 mutants. None were reused from cache. The total score was 69.59%.

The floor is 68: that score rounded down, then minus 1 point for timeout noise between runs. It replaces `break: 42`. The PR profile still sets `ignoreStatic: true`. The full weekly run does not. If those two samples drift, re-measure the full run before moving 68.

## Coverage scope

Thresholds apply to application source that the unit tests load (`src` and `packages/*/src`). CI scripts are excluded. Untested files that no test imports are not in the denominator, which is the same Vitest behavior as the measurement behind the floors. `reportOnFailure` is on, so a failing test still leaves a summary for the coverage gate.

## Ceilings and allowlists

These are frozen measurements, not relaxed minimums:

- Duplication ceiling is 2. The measured share on this change was 1.95%, rounded up to one decimal. The ceiling only moves down.
- Any critical audit finding fails. There is no waiver. A critical advisory in the report fails even when `metadata.vulnerabilities.critical` is 0. The high ceiling is 40, the count measured before the handlebars and tar bumps, and it only moves down. When the vulnerability list contains more high findings than that rollup, the higher count is compared with 40. Moderate and low are reported and do not block. npm exits non-zero for moderate findings; that exit code is not the gate. Do not use `npm audit fix --force`.
- Dependency tree ceiling is 134. `package-lock.json` on develop at `eb4b007f` resolves 134 package names at more than one version. The ceiling lives in `scripts/ci/quality-floors.mjs` as `FIND_DUPES_MAX` and only moves down. The same version installed twice does not count. The receipt lists each name and its versions. `npm find-dupes` on Node 24.10 after install proposed 7 adds, 56 removes, and 62 changes, including registry version bumps such as `@types/node` 24.12.2 to 24.19.2, so that plan is not a stable ceiling. On a lockfile-only checkout the same command errors with `Cannot read properties of null (reading 'edgesOut')`. The gate reads the lockfile.
- CRAP stays at 30. The measured max was 156, and 26 functions were already over 30. Those 26 are listed in `scripts/ci/crap-allowlist.json` as `file:name`. New functions over 30 fail. Do not raise 30.
- Dead code floor stays "0 unwaived". `scripts/ci/deadcode-allowlist.json` freezes the knip findings measured with this config (32 rows). New findings fail. The knip semantic-release plugin is off: `release.config.mjs` registers a function plugin, and knip crashes on that (`input.specifier.startsWith is not a function`). `@semantic-release/changelog` and `@semantic-release/git` stay on the allowlist because that config names them as strings.

## How to raise a floor

1. Edit `scripts/ci/quality-floors.mjs` only.
2. Coverage minimums only move up. The mutation break only moves up. Duplication, audit, dependency tree, and CRAP ceilings only move down.
3. Raise the mutation break after a full weekly run stays 2 or more points above it. Do not lower it without an explicit decision from the repo owner.
4. Remove an allowlist row when that function or knip finding is actually gone. Adding a row to hide a new failure needs the new measurement recorded in the pull request.

## Cancellation and skips

`ci-readiness` uses `if: always()`. That expression stays true when the workflow is cancelled and when a needed job fails, is skipped, or is cancelled, so the job runs and the script can fail it. `if: always() && !cancelled()` is false when the run is cancelled. GitHub then skips the job, and a skipped required check is a pass. That is the false pass this job exists to close.

Steps inside the job default to `success()`, which is false when the run is cancelled, so Checkout, Setup Node, and the readiness script would skip and the job could finish without a failure. Those three steps use `if: always()`. A last step uses `if: cancelled()` and exits 1, so a cancelled run is still red when every needed job had already succeeded.

`scripts/ci/check-ci-readiness.mjs` reads every job in `needs`. `cancelled` is a failure. `skipped` is a failure. A failed job and a missing `gate.json` stay failures. A `failure` result whose receipt is `UNKNOWN` does not add a second hard failure line. The UNKNOWN row still blocks.

No required job is skipped on purpose. The workflow has no path filters and no branch filters. `INTENTIONAL_SKIP_JOBS` is empty. A `skipped` result can pass only when the job is not a required job, its id is in that set, and this section names the job. `cancelled` is never waived. A required job cannot be waived by that set.

`coverage` and `complexity` use `if: always() && !cancelled()` so they stop after a cancelled run. That skip is not a success. Readiness fails. Step conditions (Stryker cache restore, pull request comments) do not skip the job. `quality-comments` may skip when the run is cancelled. It is not the required check.

## Branch protection

The check name to require is `CI readiness`.

Add it as a required status check on `develop`, `release`, and `main`.

A bot token receives 403 on branch protection. The repo owner sets this in the GitHub rulesets or branch protection page. Until that is done, a red `CI readiness` job does not stop a merge.
