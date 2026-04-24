# Implementation Tasks: transparent quality + selected download

**Task ID:** video-pipeline  
**Created:** 2026-04-24  
**Status:** In progress — Phases 1–4 + presentation shell advanced; revisit cookies in a later milestone.

**Product goal:** Paste a YouTube URL → see **clear, honest** information about the **best available raw quality** (per yt-dlp’s listing and your ranking policy) → **download the format the user picks** with predictable output.

**Already in place:** `analyzeVideoUrl` (yt-dlp `-J` + ranking + `bestQuality`), `downloadVideo` (save dialog + yt-dlp merge to MP4 + per-row Download in `App.tsx`), ffmpeg preflight for video-only merges, Chakra dark shell.

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

**Acceptance criteria:**
- [x] Visible explainer block (collapsible optional) after successful analyze.
- [x] Copy does not claim legal rights or guaranteed “maximum” beyond listed formats.
- [x] Mentions that **download** may merge **best audio** when a row is video-only.

### Task 1.2: Richer per-row labels (codecs + bitrate)

**Acceptance criteria:**
- [x] Each row shows bitrate when available (e.g. “~4200 kbps video”).
- [x] Row indicates “video only” vs “video+audio” in plain language.
- [x] `bestQuality` row visually highlighted or labeled “Ranked #1 (app)”.

### Task 1.3: Compare “Best” vs “Selected”

**Acceptance criteria:**
- [x] At least for the row being downloaded or hovered: comparison string is accurate vs `result.bestQuality`.
- [x] Handles `bestQuality` undefined (empty list).

---

## Phase 2: Download correctness & trust

### Task 2.1: Detect ffmpeg for merge path

**Acceptance criteria:**
- [x] Documented behavior when ffmpeg missing (message points to install or `FFMPEG_PATH`).
- [x] Unit test with mocked `execFile` / env-friendly probe.

### Task 2.2: Harden `runYtdlpDownload` arguments & output path

**Acceptance criteria:**
- [x] Success path returns a file that exists on disk when yt-dlp wrote a predictable name; directory scan covers minor name drift; otherwise throws with actionable text.
- [x] Unit tests for `findYtdlpOutputFile` (temp dirs).

### Task 2.3: Optional cookies / restricted content (spike)

**Acceptance criteria:**
- [x] Decision recorded in `spec.md` (out of v1).

---

## Phase 3: Onboarding & packaged transparency

### Task 3.1: README “First run” section

**Acceptance criteria:**
- [x] README section covers `YT_DLP_PATH`, `FFMPEG_PATH`, `MAXFRAME_FAKE_VIDEO_METADATA`, bundle folder, upstream links.

### Task 3.2: Optional CI smoke (headless / mocked)

**Acceptance criteria:**
- [x] Default PR CI stays deterministic (`MAXFRAME_FAKE_VIDEO_METADATA=1` on unit tests).
- [x] Documented optional workflow: `.github/workflows/yt-dlp-smoke.yml` (`workflow_dispatch`).

---

## Phase 4: UX polish & accessibility

### Task 4.1: Unified loading / error states

**Acceptance criteria:**
- [x] Download error does not wipe analyze results unless URL changed.
- [x] Dismissible success line for saved path.
- [x] Download in flight disables starting another download and blocks re-analyze.

### Task 4.2: Keyboard + a11y for quality list

**Acceptance criteria:**
- [x] `aria-busy` on the quality region while a download runs.
- [x] Enter on a focused row triggers download (primary action).
- [x] `role="list"` on the quality stack; labels wired with `htmlFor` / `id`.

### Task 4.3: Cypress component — download happy path

**Acceptance criteria:**
- [x] Cypress passes: mock `downloadVideo`, click Download, assert status text.

---

## Presentation (spec v0.4.0)

**Goal:** Modern dark shell with neon accents; Chakra-first.

**Acceptance criteria:**
- [x] `App` migrated off ad-hoc layout CSS to Chakra primitives + `maxframeTheme`.
- [x] **Tailwind:** not added; recorded in `plan.md` / `spec.md` as Chakra-only for this iteration.

---

## Quick reference checklist

- [x] Task 1.1: In-app explainer copy  
- [x] Task 1.2: Rich row labels + best highlight  
- [x] Task 1.3: Best vs selected comparison  
- [x] Task 2.1: ffmpeg detection / messaging  
- [x] Task 2.2: Download args + output path hardening  
- [x] Task 2.3: Cookies spike or doc decision  
- [x] Task 3.1: README first run  
- [x] Task 3.2: CI smoke strategy  
- [x] Task 4.1: Loading / error / success UX  
- [x] Task 4.2: List a11y  
- [x] Task 4.3: Cypress download mock  
- [x] Presentation: Chakra shell + theme (v0.4.0 direction)

---

## Next steps

1. Optional: richer listbox roving tabindex + `aria-activedescendant` if UX review asks for it.
2. Optional: cookies / age-gate milestone when scoped.

---

*Tasks maintained with SDD 5.0*
