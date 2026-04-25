# Implementation Tasks: Mutation Profiles and CI Strategy

**Task ID:** `video-pipeline`  
**Created:** 2026-04-25  
**Status:** Ready for Implementation

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 12 |
| Estimated Effort | ~42–58 hours |
| Phases | 5 |

## Phase 1: Reporting Foundation

**Goal:** Ensure mutation report generation and PR publication are deterministic and reliable before profile split.

### Task 1.1: Stabilize mutation report generation contract

**Description:** Ensure Stryker consistently emits JSON + HTML reports in predictable paths and confirm artifact expectations in CI.

**Acceptance Criteria:**
- [ ] Stryker config includes required reporters for machine + human output.
- [ ] CI run always attempts to upload mutation report artifacts.
- [ ] Missing-report fallback behavior is explicit and documented in workflow comments.

**Effort:** 3 hours  
**Priority:** High  
**Dependencies:** None

---

### Task 1.2: Harden PR summary generation logic

**Description:** Validate and refine markdown generation from mutation JSON including threshold status and status counters.

**Acceptance Criteria:**
- [ ] Summary computation handles missing fields safely.
- [ ] Output includes score, threshold, pass/fail status, and key counters.
- [ ] Summary step works in both successful and failing mutation runs.

**Effort:** 4 hours  
**Priority:** High  
**Dependencies:** Task 1.1

---

## Phase 2: Stryker Profile Architecture

**Goal:** Introduce strict and fast-ui mutation profiles with shared defaults and minimal duplication.

### Task 2.1: Create shared/base Stryker config strategy

**Description:** Refactor configuration layout so strict and fast profiles reuse common mutate/test-runner/threshold defaults.

**Acceptance Criteria:**
- [ ] Shared defaults are centralized in one source.
- [ ] Profile-specific overrides are isolated and readable.
- [ ] Existing mutation commands continue to work or are cleanly migrated.

**Effort:** 5 hours  
**Priority:** High  
**Dependencies:** Task 1.2

---

### Task 2.2: Implement strict profile (authoritative quality gate)

**Description:** Define strict profile behavior to run static mutants and represent release-confidence baseline.

**Acceptance Criteria:**
- [ ] Strict profile explicitly documents static-mutant behavior.
- [ ] Strict profile can be executed independently via npm script/workflow step.
- [ ] Strict profile output remains compatible with PR/CI report parser.

**Effort:** 3 hours  
**Priority:** High  
**Dependencies:** Task 2.1

---

### Task 2.3: Implement fast-ui profile (PR latency optimization)

**Description:** Add a renderer-focused profile that may use `ignoreStatic: true` for faster feedback loops.

**Acceptance Criteria:**
- [ ] Fast profile scope is explicit (`packages/renderer/src/**` strategy documented).
- [ ] `ignoreStatic` policy is explicit and justified in config/docs.
- [ ] Fast profile runs successfully and emits equivalent report format.

**Effort:** 4 hours  
**Priority:** High  
**Dependencies:** Task 2.1

---

## Phase 3: CI Orchestration Policy

**Goal:** Wire profiles to branch/trigger policy with clear ownership of strict vs fast runs.

### Task 3.1: Wire PR mutation workflow to selected profile policy

**Description:** Decide and implement whether PRs always use fast profile or use path-based switching.

**Acceptance Criteria:**
- [ ] CI mutation job uses selected profile policy consistently.
- [ ] Policy is encoded in workflow conditions or script logic, not manual convention.
- [ ] Workflow logs clearly indicate which profile ran.

**Effort:** 5 hours  
**Priority:** High  
**Dependencies:** Tasks 2.2, 2.3

---

### Task 3.2: Keep scheduled/full mutation workflow strict

**Description:** Ensure scheduled or manually triggered full mutation runs execute strict profile as authoritative baseline.

**Acceptance Criteria:**
- [ ] Full workflow explicitly references strict profile command/config.
- [ ] Runtime and thresholds are suitable for scheduled context.
- [ ] Full workflow retains artifact/report outputs for inspection.

**Effort:** 3 hours  
**Priority:** High  
**Dependencies:** Task 2.2

---

## Phase 4: Governance and Comparability

**Goal:** Prevent metric confusion and encode profile-aware reporting and policy.

### Task 4.1: Add profile metadata to mutation PR comments

**Description:** Include profile name and static-mutant mode (`ignoreStatic` on/off) in PR summary.

**Acceptance Criteria:**
- [ ] PR comment clearly labels profile and static policy.
- [ ] Summary format remains concise and stable across runs.
- [ ] Reviewers can distinguish strict vs fast scores at a glance.

**Effort:** 3 hours  
**Priority:** Medium  
**Dependencies:** Tasks 1.2, 3.1

---

### Task 4.2: Define threshold and comparison policy per profile

**Description:** Document and enforce score interpretation so strict and fast profiles are not compared incorrectly.

**Acceptance Criteria:**
- [ ] Threshold policy is documented for each profile.
- [ ] CI behavior for threshold failure is explicit and intentional.
- [ ] Contributor docs include score comparability guidance.

**Effort:** 4 hours  
**Priority:** Medium  
**Dependencies:** Tasks 2.2, 2.3, 4.1

---

## Phase 5: Validation and Rollout

**Goal:** Validate tradeoffs, finalize rollout, and hand off operational guidance.

### Task 5.1: Benchmark runtime and score delta by profile

**Description:** Run both profiles on representative PR-like and full scenarios; capture score and elapsed time.

**Acceptance Criteria:**
- [ ] Benchmark table includes runtime and score for strict vs fast profile.
- [ ] Static-mutant impact is quantified for renderer-heavy scope.
- [ ] Decision record confirms selected default PR policy.

**Effort:** 6 hours  
**Priority:** Medium  
**Dependencies:** Tasks 3.1, 3.2, 4.2

---

### Task 5.2: Finalize docs and rollout checklist

**Description:** Update strategy docs with operational runbook, failure triage guidance, and next-step backlog.

**Acceptance Criteria:**
- [ ] `docs/` includes final policy and troubleshooting notes.
- [ ] Rollout checklist includes monitoring and rollback steps.
- [ ] Next optimization opportunities are captured (e.g., additional mutant targeting).

**Effort:** 2 hours  
**Priority:** Low  
**Dependencies:** Task 5.1

---

## Quick Reference Checklist

- [ ] Task 1.1: Stabilize mutation report generation contract
- [ ] Task 1.2: Harden PR summary generation logic
- [ ] Task 2.1: Create shared/base Stryker config strategy
- [ ] Task 2.2: Implement strict profile
- [ ] Task 2.3: Implement fast-ui profile
- [ ] Task 3.1: Wire PR mutation workflow to selected profile policy
- [ ] Task 3.2: Keep scheduled/full mutation workflow strict
- [ ] Task 4.1: Add profile metadata to mutation PR comments
- [ ] Task 4.2: Define threshold and comparison policy per profile
- [ ] Task 5.1: Benchmark runtime and score delta by profile
- [ ] Task 5.2: Finalize docs and rollout checklist

## Next Steps

1. Review this task breakdown with maintainers.
2. Resolve open policy choices (always-fast PR vs path-based switch).
3. Run `/implement video-pipeline` to start execution.

---

*Tasks created with SDD 5.0*
