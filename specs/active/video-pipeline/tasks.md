> **[STALE]** — Upstream spec updated on 2026-04-24. Review needed.  
> Change: Presentation layer + cyberpunk-modern UI direction (spec.md v0.4.0)

# Implementation Tasks: transparent quality + selected download

**Task ID:** video-pipeline  
**Created:** 2026-04-24  
**Status:** Ready for implementation  

**Product goal:** Paste a YouTube URL → see **clear, honest** information about the **best available raw quality** (per yt-dlp’s listing and your ranking policy) → **download the format the user picks** with predictable output.

**Already in place:** `analyzeVideoUrl` (yt-dlp `-J` + ranking + `bestQuality`), `downloadVideo` (save dialog + yt-dlp merge to MP4 + per-row Download in `App.tsx`).

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 10 |
| Estimated effort | ~34–46 h (spread across phases) |
| Phases | 4 |

---

## Phase 1: Transparency (“what am I seeing?”)

**Goal:** Users understand what “best” means and how rows relate to it—without implying YouTube Premium, “master” files, or HDR where not listed.

### Task 1.1: In-app “What we show” copy + layout

**Description:** Add a short, static explainer near results: qualities come from **yt-dlp** at analyze time; “best” = highest per `QualityRankingPolicy` (resolution → fps → bitrate); not all YouTube client features (e.g. app-only tiers) may appear.

**Acceptance criteria:**
- [x] Visible explainer block (collapsible optional) after successful analyze.
- [x] Copy does not claim legal rights or guaranteed “maximum” beyond listed formats.
- [x] Mentions that **download** may merge **best audio** when a row is video-only.

**Effort:** 2–3 h  
**Priority:** High  
**Dependencies:** None  

---

### Task 1.2: Richer per-row labels (codecs + bitrate)

**Description:** Extend UI (and optionally `QualityOption` mapping if missing) to show `videoBitrateKbps` / `audioBitrateKbps` where present; show container + `hasAudio` so users see why merge happens.

**Acceptance criteria:**
- [x] Each row shows bitrate when available (e.g. “~4200 kbps video”).
- [x] Row indicates “video only” vs “video+audio” in plain language.
- [x] `bestQuality` row visually highlighted or labeled “Ranked #1 (app)”.

**Effort:** 3–5 h  
**Priority:** High  
**Dependencies:** Task 1.1 (copy can reference new labels)  

---

### Task 1.3: Compare “Best” vs “Selected”

**Description:** When user focuses a row or hovers Download, show a one-line diff vs `bestQuality` (e.g. “Lower resolution than best listed” / “Same as best”).

**Acceptance criteria:**
- [x] At least for the row being downloaded or hovered: comparison string is accurate vs `result.bestQuality`.
- [x] Handles `bestQuality` undefined (empty list).

**Effort:** 3–4 h  
**Priority:** Medium  
**Dependencies:** Task 1.2  

---

## Phase 2: Download correctness & trust

**Goal:** Selected-quality download fails less mysteriously; users know if **ffmpeg** / merge is missing.

### Task 2.1: Detect ffmpeg for merge path

**Description:** Before or after download, verify policy: if merge/format needs ffmpeg, probe `ffmpeg` on PATH (or bundled path later) and surface a clear error **before** long yt-dlp runs when possible.

**Acceptance criteria:**
- [ ] Documented behavior when ffmpeg missing (message points to install or bundle plan).
- [ ] Unit or integration test with mocked `execFile` / env.

**Effort:** 4–6 h  
**Priority:** High  
**Dependencies:** None  

---

### Task 2.2: Harden `runYtdlpDownload` arguments & output path

**Description:** Audit `-f` selector for edge cases (e.g. `bestaudio` missing, single-file formats); improve `guessOutputPath` / final path returned to match yt-dlp’s actual output (including merge suffixes).

**Acceptance criteria:**
- [ ] Golden tests or manual matrix for 3–5 real URLs documented in `specs/` or README dev notes.
- [ ] Success message shows path that exists (`existsSync`) or primary candidate + note.

**Effort:** 4–6 h  
**Priority:** High  
**Dependencies:** Task 2.1 (ffmpeg messaging intertwined)  

---

### Task 2.3: Optional cookies / restricted content (spike)

**Description:** Spike passing **Netscape cookies** file path to yt-dlp for age-gated content; if in scope, add settings + IPC; if out of scope, document limitation in UI explainer.

**Acceptance criteria:**
- [ ] Decision recorded in `spec.md` (in or out of v1).
- [ ] If in: minimal UI + env or file picker + safe storage note.

**Effort:** 6–8 h (if in scope); 2 h (doc-only spike)  
**Priority:** Low  
**Dependencies:** None  

---

## Phase 3: Onboarding & packaged transparency

**Goal:** First-run and README match reality: yt-dlp required, optional bundle, fake-metadata mode for dev.

### Task 3.1: README “First run” section

**Description:** Document `YT_DLP_PATH`, `MAXFRAME_FAKE_VIDEO_METADATA`, `buildResources/yt-dlp`, and typical Windows/macOS/Linux install links for yt-dlp / ffmpeg.

**Acceptance criteria:**
- [ ] README section ≤1 screen; links to upstream releases.
- [ ] States analyze vs download requirements clearly.

**Effort:** 1–2 h  
**Priority:** High  
**Dependencies:** None  

---

### Task 3.2: Optional CI smoke (headless / mocked)

**Description:** Add a job or script step that runs analyze with `MAXFRAME_FAKE_VIDEO_METADATA=1` or mocks IPC—avoid flaky network in default CI; optional nightly with real yt-dlp.

**Acceptance criteria:**
- [ ] Default PR CI stays deterministic.
- [ ] Documented optional workflow for real yt-dlp (manual or cron).

**Effort:** 3–5 h  
**Priority:** Medium  
**Dependencies:** Task 3.1  

---

## Phase 4: UX polish & accessibility

**Goal:** Paste → analyze → pick quality feels like one flow; errors are actionable.

### Task 4.1: Unified loading / error states

**Description:** Single loading concept for analyze vs download; preserve last successful `result` when a download fails; dismissible success toast for path.

**Acceptance criteria:**
- [ ] Download error does not wipe analyze results unless URL changed.
- [ ] Loading states don’t double-enable destructive actions.

**Effort:** 2–4 h  
**Priority:** Medium  
**Dependencies:** Phase 1–2 partial (stable labels)  

---

### Task 4.2: Keyboard + a11y for quality list

**Description:** Table or listbox semantics: row focus, Enter to download primary action, `aria-busy` during download.

**Acceptance criteria:**
- [ ] axe or eslint-plugin-jsx-a11y clean on quality section.
- [ ] Cypress or RTL test for one a11y invariant.

**Effort:** 3–5 h  
**Priority:** Medium  
**Dependencies:** Task 1.2  

---

### Task 4.3: Cypress component — download happy path

**Description:** Extend component test: mock `downloadVideo`, click Download, assert status text.

**Acceptance criteria:**
- [ ] Cypress passes in CI config that already runs component tests.

**Effort:** 1–2 h  
**Priority:** Low  
**Dependencies:** Task 4.1  

---

## Quick reference checklist

- [ ] Task 1.1: In-app explainer copy  
- [ ] Task 1.2: Rich row labels + best highlight  
- [ ] Task 1.3: Best vs selected comparison  
- [ ] Task 2.1: ffmpeg detection / messaging  
- [ ] Task 2.2: Download args + output path hardening  
- [ ] Task 2.3: Cookies spike or doc decision  
- [ ] Task 3.1: README first run  
- [ ] Task 3.2: CI smoke strategy  
- [ ] Task 4.1: Loading / error / success UX  
- [ ] Task 4.2: List a11y  
- [ ] Task 4.3: Cypress download mock  

---

## Next steps

1. Review `tasks.md` with product priorities (transparency vs cookies vs CI).
2. Run `/implement video-pipeline` or pick tasks in order starting **Phase 1**.
3. After Phase 2, update `plan.md` out-of-scope lines (ffmpeg, progress) if scope shifts.

---

*Tasks created with SDD 5.0*
