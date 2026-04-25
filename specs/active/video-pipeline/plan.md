# Technical Plan: Video Pipeline + Mutation Strategy

**Task ID:** `video-pipeline`  
**Status:** Ready for Implementation  
**Based on:** `specs/active/video-pipeline/spec.md`, `specs/active/video-pipeline/research.md`, `docs/stryker-static-mutants-tradeoffs.md`

## 1. System Architecture

The feature remains split into two systems:

1. **Product runtime path** (analyze/download with yt-dlp + ffmpeg checks + renderer UX)
2. **Quality enforcement path** (unit/component/mutation testing + CI publication)

For mutation testing, adopt a profile-based architecture:

- **Strict profile:** run static mutants for high-fidelity quality gates.
- **Fast UI profile:** allow `ignoreStatic` in renderer-oriented runs to reduce PR turnaround where static mutants dominate runtime.

### Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mutation profiles | Dual profile (`strict`, `fast-ui`) | Balances CI speed and mutation fidelity. |
| Static mutant policy | Keep for core, optional ignore for renderer fast path | Core startup behavior carries higher risk; UI has higher static cost. |
| Report publication | Sticky PR comments + artifacts | Matches existing coverage visibility pattern and improves review ergonomics. |
| Score governance | Keep break threshold in shared config, compare scores within same profile | Avoid misleading strict-vs-fast score comparisons. |

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Mutation engine | StrykerJS | existing | Already integrated with incremental caching and Vitest runner. |
| Unit/component runner | Vitest + Testing Library | existing | Current test baseline and Stryker integration point. |
| CI orchestration | GitHub Actions | existing | Existing PR + scheduled automation. |
| PR publication | marocchino/sticky-pull-request-comment | existing | Same pattern as unit coverage comments. |
| Artifact storage | actions/upload-artifact | existing | Stores mutation HTML/JSON for deeper inspection. |

### Dependencies

No new package dependency required for this planning step; implementation should reuse existing tooling.

## 3. Component Design

### Component: Stryker Configuration Profiles
- **Purpose:** Encode strict and fast mutation behavior without duplicating all options.
- **Responsibilities:**
  - Keep shared mutate/test-runner/threshold defaults.
  - Override only profile-specific behavior (e.g., `ignoreStatic`, mutate scope).
- **Interfaces:**
  - npm scripts (`test:mutation`, `test:mutation:incremental`, profile-specific scripts if added).
- **Dependencies:** `stryker.config.mjs`, optional additional config files.

### Component: CI Mutation Job(s)
- **Purpose:** Execute mutation profile(s) based on trigger and branch policy.
- **Responsibilities:**
  - run mutation command
  - upload reports artifact
  - generate markdown summary from JSON
  - post sticky PR comment
- **Interfaces:** `.github/workflows/ci.yml`, `.github/workflows/stryker-full.yml`
- **Dependencies:** Stryker JSON output in `reports/mutation/mutation.json`.

### Component: Mutation Summary Generator
- **Purpose:** Transform Stryker JSON into concise PR-readable status.
- **Responsibilities:**
  - derive score and counters
  - include threshold status
  - include profile metadata and static policy state
- **Interfaces:** Inline Node step in workflow or reusable script.
- **Dependencies:** JSON reporter enabled.

### Component: Quality Strategy Documentation
- **Purpose:** Explain when strict vs fast profile is authoritative.
- **Responsibilities:** Keep policy, tradeoffs, and risk mitigations discoverable for contributors.
- **Interfaces:** `docs/stryker-static-mutants-tradeoffs.md` + CI docs notes.

## 4. Data Model

### Mutation Report Shape (Consumed)

```ts
type MutationReport = {
  thresholds?: { high?: number; low?: number; break?: number | null };
  files?: Record<
    string,
    {
      mutants?: Array<{
        status?: 'Killed' | 'Survived' | 'Timeout' | 'NoCoverage' | 'RuntimeError' | 'CompileError' | 'Ignored' | string;
        static?: boolean;
      }>;
    }
  >;
};
```

### Derived Summary Model

```ts
type MutationSummary = {
  profile: 'strict' | 'fast-ui';
  ignoreStatic: boolean;
  mutationScorePct: number;
  thresholdBreak: number | null;
  counts: {
    killed: number;
    survived: number;
    timeout: number;
    noCoverage: number;
    runtimeError: number;
    compileError: number;
    ignored: number;
    pending: number;
  };
};
```

## 5. API Contracts

No external HTTP API changes. Internal CI contract:

| Producer | Output | Consumer |
|---|---|---|
| Stryker run | `reports/mutation/mutation.json` | Mutation summary step |
| Stryker run | `reports/mutation/mutation.html` | Uploaded artifact/manual inspection |
| Summary step | `mutation-test-results.md` | Sticky PR comment action |

## 6. Security Considerations

- CI comment generation must only parse local report files, not external input.
- Keep PR comment permissions scoped to `pull-requests: write` for only jobs that need it.
- Avoid exposing environment secrets in generated markdown.

## 7. Performance Strategy

- Use incremental mutation cache for PR flow.
- Keep strict full runs in scheduled workflow to protect long-term confidence.
- Use fast profile selectively for renderer-heavy PRs to reduce static-mutant overhead.
- Track average runtime and mutation score by profile to ensure optimization does not hide regressions.

## 8. Implementation Phases

- [ ] **Phase 1:** Stabilize JSON/HTML reporting and PR summary publication for current profile.
- [ ] **Phase 2:** Introduce profile-aware Stryker config split (`strict` + `fast-ui`).
- [ ] **Phase 3:** Wire CI trigger policy (PR fast profile, scheduled strict profile).
- [ ] **Phase 4:** Extend PR summary with profile + `ignoreStatic` metadata and comparability notes.
- [ ] **Phase 5:** Validate score/runtime tradeoffs and adjust thresholds/governance.

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Ignoring static mutants hides startup regressions | High | Medium | Keep strict scheduled/full runs as authoritative gate. |
| Profile score comparisons become misleading | Medium | High | Label profile and static policy in PR summary. |
| CI complexity increases maintenance burden | Medium | Medium | Keep shared config base; isolate only necessary overrides. |
| Mutation runtime still too high | Medium | Medium | Continue targeting high-cost survivor clusters and static-heavy files. |

## 10. Open Questions

1. Should PRs always run fast profile, or conditionally by changed paths?
2. Should `main`-bound PRs require both fast and strict profiles before merge?
3. Should strict and fast scores have separate explicit thresholds?

## Out of Scope

- Refactoring core yt-dlp download architecture itself.
- Replacing Vitest/Stryker stack with alternate mutation tooling.

## Next Steps

1. Review this plan with maintainers.
2. Run `/tasks video-pipeline` to generate executable work items for profile split + CI policy.
3. Run `/implement video-pipeline` to apply the plan.
