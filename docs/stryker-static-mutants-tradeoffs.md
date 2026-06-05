# Deep Research: Stryker Static Mutants Tradeoffs (Maxframe)

**Date:** 2026-04-25  
**Scope:** Evaluate whether to run or ignore static mutants in this repo, and how to report mutation outcomes on PRs.

---

## Executive Summary

Maxframe currently uses StrykerJS with `coverageAnalysis: "perTest"` and incremental mode in CI. Recent runs show repeated warnings that a small portion of static mutants can consume a disproportionate amount of runtime. This aligns with Stryker’s guidance that static mutants are often the most expensive class to execute because they need fresh runtime contexts and have weaker test filtering.

For this codebase, the best near-term strategy is **hybrid by scope**:

1. Keep **strict static-mutant execution** for backend/core mutation runs (`src/**`) where startup-time behavior matters and module-level decisions are riskier.
2. Introduce a **UI-focused mutation profile** (for `packages/renderer/src/**`) that can use `ignoreStatic: true` when turnaround speed is more important than static bootstrap fidelity.
3. Publish mutation score and counters directly in PR comments to make quality drift visible, similarly to unit coverage comments.

---

## Codebase Analysis

### Existing Patterns

- CI already publishes unit coverage to PR via sticky comment in `.github/workflows/ci.yml`.
- Mutation testing runs in a dedicated job (`mutation-tests`) but currently only executes Stryker without PR summary publication.
- `stryker.config.mjs` previously enabled `html` + console reporters; JSON output was not enabled for machine-readable PR summaries.

### Observed Runtime Signals in This Repo

- Stryker emits warnings during incremental runs indicating static mutants can dominate runtime.
- Mutation improvements are currently test-driven in renderer/infrastructure; there is a practical tension between higher score and acceptable CI latency.

---

## Deep External Findings

### 1) Static mutants are inherently expensive

Stryker defines static mutants as mutants executed during module load, not during test runtime. Because of that, mutation switching cannot toggle them like regular runtime mutants. Running them typically requires full test environment resets, with major performance impact.

Source: [Static mutants - Stryker Mutator](https://stryker-mutator.io/docs/mutation-testing-elements/static-mutants/)

### 2) `ignoreStatic` is supported in StrykerJS

StrykerJS supports ignoring static mutants (`ignoreStatic: true` / `--ignoreStatic`). Ignored static mutants do not count against mutation score. This is explicitly documented as a tradeoff between realism and runtime.

Source: [Static mutants - Stryker Mutator](https://stryker-mutator.io/docs/mutation-testing-elements/static-mutants/)  
Source: [StrykerJS configuration: ignoreStatic](https://stryker-mutator.io/docs/stryker-js/configuration/)

### 3) `ignoreStatic` requires per-test coverage analysis

Stryker docs note that enabling `ignoreStatic` requires `coverageAnalysis: "perTest"` because static detection relies on per-test coverage metadata. Maxframe already satisfies this requirement.

Source: [StrykerJS configuration: ignoreStatic](https://stryker-mutator.io/docs/stryker-js/configuration/)

### 4) JSON reporter is suitable for PR publication

StrykerJS supports the `json` reporter, with default output at `reports/mutation/mutation.json`, enabling CI scripts to generate markdown summaries and sticky PR comments.

Source: [StrykerJS configuration: jsonReporter](https://stryker-mutator.io/docs/stryker-js/configuration/)

---

## Core vs UI Tradeoff Matrix

| Dimension                          | Core (`src/**`)    | UI (`packages/renderer/src/**`)                 |
| ---------------------------------- | ------------------ | ----------------------------------------------- |
| Static bootstrap correctness value | High               | Medium                                          |
| CI runtime sensitivity             | Medium             | High                                            |
| Static-mutant signal quality       | Higher             | Often noisier (theme/constants/bootstrap-heavy) |
| Recommended default                | Run static mutants | Consider `ignoreStatic: true` in fast profile   |
| Release gate profile               | Strict             | Balanced/fast                                   |

---

## Recommended Strategy for Maxframe

### Primary recommendation

Adopt **two mutation profiles**:

- **Strict profile** (nightly or release-facing): run static mutants for full fidelity.
- **Fast PR profile** (especially renderer-heavy PRs): optionally ignore static mutants in UI scope to control latency while preserving actionable mutant feedback.

### Why this fits

- Maintains strong safety guarantees where startup/module wiring matters most.
- Reduces feedback loop time for UI-heavy changes where static mutants can be disproportionately expensive.
- Aligns with Stryker’s documented static-mutant behavior and knobs.

### Practical policy

- Do **not** globally disable static mutants for everything.
- Prefer **scope-aware** use (by config/profile) and track score trends separately for strict vs fast profiles to prevent hidden quality erosion.

---

## PR Reporting Recommendation

Mutation testing should publish a sticky PR summary the same way unit coverage does. Minimum fields:

- mutation score
- threshold and pass/fail status
- killed/survived/timeout/no-coverage counts
- link to artifact containing full `reports/mutation/*`

This keeps mutation outcomes visible and reviewable without opening full logs.

---

## Risks and Mitigations

- **Risk:** Ignoring static mutants can mask startup regressions.
  - **Mitigation:** Keep a strict scheduled/full mutation workflow that runs static mutants.
- **Risk:** PR score can appear better when ignored mutants are removed from denominator.
  - **Mitigation:** Explicitly label PR summary with profile (`strict` vs `fast`) and `ignoreStatic` state.
- **Risk:** Increased CI complexity (multiple profiles).
  - **Mitigation:** Start with one incremental PR profile + one weekly full strict profile.

---

## Implementation (2026-06-05)

Dual profiles are now in place:

| Profile | Config | Used by |
|---|---|---|
| **Strict** | `stryker.config.mjs` | `npm run test:mutation`, weekly `stryker-full.yml` |
| **PR fast** | `stryker.config.pr.mjs` | `npm run test:mutation:pr:incremental`, CI `mutation-tests` job |

Shared options live in `stryker.config.base.mjs`. PR fast sets `ignoreStatic: true` and excludes `InMemoryVideoMetadataGateway.ts` (test double). See `specs/active/stryker-172-mutants/`.

---

## Suggested Next Iteration

1. Add a renderer mutation profile (optional; `packages/renderer/src/**` with `ignoreStatic: true`).
2. Track strict vs fast score trendlines from weekly artifacts.
3. Kill runtime survived mutants in ytdlp/ffmpeg surfaces as backlog allows.

---

## Sources

- [Stryker Mutator - Static mutants](https://stryker-mutator.io/docs/mutation-testing-elements/static-mutants/)
- [StrykerJS Configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)
- [StrykerJS Configuration (GitHub docs mirror)](https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md)
