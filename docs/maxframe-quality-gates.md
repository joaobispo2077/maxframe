# Maxframe quality gates

Every gate in `.github/workflows/ci.yml` blocks. A missing report or summary is `UNKNOWN` and blocks. `CI readiness` fails when any required job is failed, skipped, cancelled, or `UNKNOWN`.

Floors live in `scripts/ci/quality-floors.mjs`. Vitest imports the coverage minimums. `stryker.config.base.mjs` imports the mutation break. Do not copy those numbers into a second file.

## Gates

| Gate                     | What it checks                                                                                                                                                  | Floor                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck                | `tsc` via workspace typecheck                                                                                                                                   | 0 errors                                                                                                                       |
| Lint                     | ESLint                                                                                                                                                          | 0 errors, warnings at or under the existing warning baseline                                                                   |
| Format                   | Prettier                                                                                                                                                        | 0 files to change                                                                                                              |
| Unit tests               | Vitest                                                                                                                                                          | tests pass                                                                                                                     |
| E2E tests                | Cypress component tests                                                                                                                                         | tests pass                                                                                                                     |
| Coverage                 | Vitest v8 `coverage-summary.json` for application source loaded by the unit tests. `scripts/**` is excluded so the gate measures the app, not the gate scripts. | statements 74, branches 63, functions 81, lines 75                                                                             |
| CRAP / complexity        | ESLint modified complexity per function, joined with `coverage-final.json`. CRAP is `complexity^2 * (1 - coverage)^3 + complexity`.                             | complexity at most 12, CRAP at most 30, and no new function over that line                                                     |
| Duplication              | jscpd on `src` and the package `src` trees                                                                                                                      | at most 2% duplicated lines                                                                                                    |
| Dead code                | knip                                                                                                                                                            | 0 findings that are not on `scripts/ci/deadcode-allowlist.json`                                                                |
| Architecture             | dependency-cruiser                                                                                                                                              | 0 violations. Domain does not import infrastructure. Renderer does not import main. Renderer source does not import Node core. |
| Dependency audit         | `npm audit --json`                                                                                                                                              | 0 critical, and at most 40 high                                                                                                |
| Electron security        | `webPreferences` on every `BrowserWindow` under main, preload, and renderer source                                                                              | `contextIsolation` true, `nodeIntegration` false, `sandbox` true                                                               |
| Mutation tests           | Stryker incremental on changed files under `src/**/*.ts` (the full PR mutate set when that diff is empty). Weekly `stryker-full.yml` still runs the full set.   | break 68                                                                                                                       |
| Scheduled workflow state | `stryker-full.yml` is readable and active                                                                                                                       | workflow state is readable and not disabled                                                                                    |

`size-limit` stays a signal. It is not one of these blocking gates.

## How a result is chosen

- `PASS`: the report exists and the measured value meets the floor.
- `FAIL`: the report exists and the measured value misses the floor, or the job was skipped or cancelled.
- `UNKNOWN`: the report or the counts are missing. This is not a pass.

The Software metrics sticky (`quality-gates-report`) has one row per gate: value, floor, and `PASS`, `FAIL`, or `UNKNOWN`. Its overall matches `CI readiness`, and the chart overall token matches that same overall. The gate status chart counts those same rows. PNG files are uploaded as the `quality-charts` artifact and are not embedded in the comment, because a relative `charts/*.png` path does not render on GitHub.

The Mutation tests sticky (`mutation-report`) shows the score, killed, survived, timeout, no coverage, tested this run, cached, the floor, and a link to the HTML report artifact from the same run attempt. Its overall is the mutation row only. A score with 0 mutants tested this run is UNKNOWN, because that score is cache-only. When no mutable source changed, the job runs the PR mutate set without the incremental cache, and the sticky says that no mutable source changed.

## Mutation floor

Stryker full run [39808689775](https://github.com/joaobispo2077/maxframe/actions/runs/39808689775) on `develop` at `2318f38b` tested all 1391 mutants. None were reused from cache. The total score was 69.59%.

The floor is 68: that score rounded down, then minus 1 point for timeout noise between runs. It replaces `break: 42`. The PR profile still sets `ignoreStatic: true`. The full weekly run does not. If those two samples drift, re-measure the full run before moving 68.

## Coverage scope

Thresholds apply to application source that the unit tests load (`src` and `packages/*/src`). CI scripts are excluded. Untested files that no test imports are not in the denominator, which is the same Vitest behavior as the measurement behind the floors. `reportOnFailure` is on, so a failing test still leaves a summary for the coverage gate.

## Ceilings and allowlists

These are frozen measurements, not relaxed minimums:

- Duplication ceiling is 2. The measured share on this change was 1.95%, rounded up to one decimal. The ceiling only moves down.
- Any critical audit finding fails. There is no waiver. The high ceiling is 40, the count measured before the handlebars and tar bumps, and it only moves down. Moderate and low are reported and do not block. Do not use `npm audit fix --force`.
- CRAP stays at 30. The measured max was 156, and 26 functions were already over 30. Those 26 are listed in `scripts/ci/crap-allowlist.json` as `file:name`. New functions over 30 fail. Do not raise 30.
- Dead code floor stays "0 unwaived". `scripts/ci/deadcode-allowlist.json` freezes the knip findings measured with this config (32 rows). New findings fail. The knip semantic-release plugin is off: `release.config.mjs` registers a function plugin, and knip crashes on that (`input.specifier.startsWith is not a function`). `@semantic-release/changelog` and `@semantic-release/git` stay on the allowlist because that config names them as strings.

## How to raise a floor

1. Edit `scripts/ci/quality-floors.mjs` only.
2. Coverage minimums only move up. The mutation break only moves up. Duplication, audit, and CRAP ceilings only move down.
3. Raise the mutation break after a full weekly run stays 2 or more points above it. Do not lower it without an explicit decision from the repo owner.
4. Remove an allowlist row when that function or knip finding is actually gone. Adding a row to hide a new failure needs the new measurement recorded in the pull request.

## Branch protection

The check name to require is `CI readiness`.

Add it as a required status check on `develop`, `release`, and `main`.

A bot token receives 403 on branch protection. The repo owner sets this in the GitHub rulesets or branch protection page. Until that is done, a red `CI readiness` job does not stop a merge.
