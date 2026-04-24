# Video pipeline — metadata & extraction

**Status:** Active  
**Scope:** How Maxframe resolves YouTube URLs, lists formats (**analyze**), and downloads a chosen format (**download**) using yt-dlp.

## Revision History

| Version | Date       | Author | Summary |
|---------|------------|--------|---------|
| 0.1.0   | 2026-04-24 | evolve | Initial spec from implementation review: document why yt-dlp is default and how axios + ffmpeg fit. |
| 0.2.0   | 2026-04-24 | implement | Download IPC + `extraResources` bundle hook; `resolveYtdlpExecutable` checks `resources/yt-dlp/`. |
| 0.3.0   | 2026-04-24 | implement | Phase 1 transparency UI: yt-dlp explainer, bitrates, Ranked #1 badge, hover/focus vs-best line. |
| 0.4.0   | 2026-04-24 | evolve | Presentation requirements: modern “Cyberpunk 2077–inspired” shell; Chakra-first UI; layout/spacing overhaul. |

---

## Presentation layer (UI/UX) — **new (v0.4.0)**

**Problem statement:** The current shell is functionally adequate but visually dated: cramped label/input/button alignment, flat gray canvas, and minimal hierarchy. Stakeholder feedback: **must feel modern**, with a **Cyberpunk 2077–inspired** aesthetic (high contrast, neon accents on dark surfaces, subtle grid/glow, confident typography)—**inspired by**, not a 1:1 IP reproduction.

**Direction:**

1. **Chakra UI v3 (primary)** — `ChakraProvider` already wraps the renderer; **migrate** `App` (and related layout) from ad-hoc `index.css` primitives to **Chakra components** (`Box`, `Stack`, `Container`, `Heading`, `Text`, `Input`, `Button`, `Badge`, `Card` / recipes, `Accordion` or collapsible for the explainer, `Alert` for errors). Centralize **semantic tokens** (background, border, accent cyan/magenta, danger) in the Chakra **system/theme** rather than scattered hex in CSS.
2. **Tailwind-style modernity** — The repo **does not** currently ship Tailwind. Either (a) **add Tailwind** + `@chakra-ui/react` integration per current ecosystem docs, or (b) achieve the same density/spacing/radius discipline **using Chakra tokens + recipes only** (preferred if it keeps the stack thinner). Record the decision in `plan.md` when implementation starts.
3. **Layout** — Full-viewport **app shell** (not a tiny floating postcard): max-width content column with breathing room; URL field and primary CTA on **separate rows** or a clear horizontal **group** with consistent `gap`; responsive breakpoints for narrow windows.
4. **Motion & depth** — Optional subtle transitions (project already depends on `framer-motion` at workspace root—use sparingly for focus/hover, not distracting loops).
5. **Accessibility** — Contrast ratios must remain WCAG-friendly despite neon accents; focus rings visible on dark theme.

**Non-goals:** Full game UI clone; licensed artwork; unreadable “hacker green on black” defaults.

## Problem

YouTube does not expose stable, public “file URLs” for arbitrary quality tiers. Clients must reproduce **player-derived logic** (InnerTube / `player` JS, `n` transforms, signature cipher, age/consent flows). That logic changes without notice.

## Options (short)

| Approach | Role | Maintenance | Typical performance (analyze) |
|----------|------|---------------|----------------------------------|
| **yt-dlp** (CLI or library bindings) | Full extractor: resolves formats, returns JSON or downloads | Community-maintained; high correctness | Dominated by YouTube round-trip + JSON parse; process spawn adds modest fixed cost on desktop |
| **Custom axios + InnerTube** | Your code calls Google APIs and parses responses like a first-party client | **High** — breaks when YouTube ships player updates | Can be slightly leaner if you avoid subprocess, but network + parsing still dominate |
| **ffmpeg** | Demux/mux/transcode **after** you already have signed media URLs | Stable for container work | Not used for “listing formats” by itself; no URL discovery |

**Clarification:** `ffmpeg` does not replace an extractor. It operates on URLs or files you already obtained. **axios** alone does not grant those URLs unless you implement (or embed) the same extraction rules yt-dlp encodes.

## Decision (current implementation)

- **Default metadata path:** `yt-dlp -J --skip-download` via `YtdlpVideoMetadataGateway`, mapped to domain `QualityOption`s.
- **Rationale:** Reliability and velocity for a desktop downloader outweigh saving a subprocess on analyze; correctness drift is outsourced to yt-dlp.
- **Escape hatches:** `YT_DLP_PATH` for binary location; `MAXFRAME_FAKE_VIDEO_METADATA=1` for deterministic tests / no binary.
- **Download:** Main-process IPC + save dialog runs yt-dlp with merge to MP4; see `packages/main/src/downloadVideoHandler.ts` and preload `downloadVideo`.
- **Packaged binary:** Optional `buildResources/yt-dlp/` → app `resources/yt-dlp/` via `electron-builder` `extraResources` (see `buildResources/yt-dlp/README.txt`).
- **Transparency (UI):** Collapsible explainer after analyze; each row shows stream kind + optional bitrates; top-ranked row badge; hover/focus shows one-line comparison vs `bestQuality` (`packages/renderer/src/qualityTransparency.ts`). **Styling** is interim (plain CSS); **v0.4.0+** targets Chakra-based cyberpunk-modern shell (see Presentation layer).

## Discovery / refinement (2026-04-24 — presentation)

**Type:** Addition (product / UX)  
**Context:** Current analyze shell reviewed as **not** meeting a “modern app” bar; target look aligned with **Cyberpunk 2077–style** contemporary product UI (dark chrome, neon accents, structured layout) and stacks seen in **Tailwind + Chakra** apps.

**Change:** Formalize **Presentation layer** requirements above; implementation should replace the minimal centered card pattern with a deliberate design system.

**Impact:** New workstream (UI refactor). Does not change yt-dlp or IPC contracts; may add theme files and Chakra recipes under `packages/renderer/`.

---

## Discovery / refinement (2026-04-24)

**Type:** Refinement + optional future modification  
**Context:** Assumption that yt-dlp was “reference only” and that **axios + ffmpeg** would be faster end-to-end.

**Change:** Document that yt-dlp is an intentional **production** default for YouTube URL and format resolution, not a throwaway stub. axios + ffmpeg is a valid **composition** for later stages (HTTP fetch of segments, mux), not a drop-in replacement for extraction without substantial custom InnerTube work.

**Impact:** No mandatory code revert from this note alone. If product goals shift to “no subprocess” or “minimal deps,” plan a **spike** on InnerTube + axios and keep ffmpeg for mux only; accept ongoing breakage risk or budget for rapid fixes.

## Out of scope (this document)

- Download **progress** streaming / cancel tokens.
- Automatic per-arch yt-dlp fetch in CI (manual copy or separate release job).
- Pixel-perfect recreation of third-party game UIs or use of unlicensed marks beyond **stylistic inspiration**.

## Cross-references

- Code: `src/infrastructure/youtube/YtdlpVideoMetadataGateway.ts`, `mapYtdlpFormatsToQualityOptions.ts`, `runYtdlpDownload.ts`, `resolveYtdlpExecutable.ts`
- Handlers: `src/interface/ipc/analyzeVideoHandler.ts`, `packages/main/src/downloadVideoHandler.ts`
- Build: `electron-builder.mjs`, `buildResources/yt-dlp/README.txt`
- Renderer: `packages/renderer/src/App.tsx`, `packages/renderer/src/qualityTransparency.ts`, `packages/renderer/src/index.css` (interim); future **Chakra theme / recipes** for v0.4.0 presentation layer (TBD path under `packages/renderer/`).
