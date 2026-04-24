# Research: YouTube extractors vs yt-dlp (deep)

**Task ID:** video-pipeline  
**Date:** 2026-04-24  
**Status:** Complete  
**Mode:** Deep (`--deep`)

---

## Executive Summary

For Maxframe (Electron + TypeScript, **analyze-then-download** roadmap), **extractor choice is a product/architecture trade**, not a single “fastest library.” Verified signals:

- **yt-dlp** has massive adoption (on the order of **~158k** GitHub stars as of fetch date) and remains the **lowest-risk** way to stay current with YouTube player changes while supporting **many non-YouTube** hosts if the product expands.
- **youtubei.js** (`youtubei.js` on npm) is the **primary in-process** InnerTube stack: **~89.3k weekly downloads**, **97 dependents**, MIT license, active releases. Official docs explicitly state that **deciphering streaming URLs requires executing YouTube’s obfuscated JS** and that **you must supply your own interpreter** (example uses `Function` — security-sensitive in Electron).
- The **DisTube-maintained `@distube/ytdl-core` fork is officially unmaintained**; its README directs users to **youtubei.js** and `@distube/youtube` extractor plugins — a strong signal to **not** anchor new work on that fork.
- **Remote APIs** (e.g. **Piped** `GET /streams/:videoId`) offer a **stable HTTP contract** and shift extraction to **your or a third-party server**, trading **privacy, uptime, abuse policy, and ops** for client simplicity. **Invidious** JSON APIs exist but community issues show **format payload fragility** when YouTube changes streaming modes — same class of risk, different operator.

**Bottom line:** “Better” depends on goals: **correctness + breadth + low app code** → yt-dlp; **no subprocess + Node-native** → youtubei.js with a **deliberate VM/security story**; **thin client** → self-hosted Piped-like API; **avoid** deprecated ytdl-core lines for new designs.

---

## Codebase Analysis

### Existing patterns

**Port-based extraction (`VideoMetadataGateway`)**

**Location:** `src/application/ports/VideoMetadataGateway.ts`

The use case depends only on `analyzeVideo(url): Promise<QualityOption[]>`, so **any** extractor that returns the same domain types can plug in without changing domain logic.

**Location:** `src/application/use-cases/AnalyzeVideoUrlUseCase.ts`

Ranking and error mapping stay unchanged if a new gateway is swapped in.

### Current implementations

| Component | Location | Role |
|-----------|----------|------|
| yt-dlp CLI gateway | `src/infrastructure/youtube/YtdlpVideoMetadataGateway.ts` | `execFile` → JSON → `mapYtdlpFormatsToQualityOptions` |
| JSON → domain mapper | `src/infrastructure/youtube/mapYtdlpFormatsToQualityOptions.ts` | Pure; reusable if another backend emits yt-dlp-shaped JSON |
| In-memory stub | `src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts` | Tests / `MAXFRAME_FAKE_VIDEO_METADATA=1` |
| IPC wiring | `src/interface/ipc/analyzeVideoHandler.ts` | Chooses default gateway (fake vs yt-dlp) |

**Reusability:** Additional gateways (youtubei.js, Piped HTTP client) should live under `src/infrastructure/youtube/` and implement `VideoMetadataGateway`.

### Conventions to follow

- Keep **YouTube-specific IO** behind `VideoMetadataGateway`.
- Prefer **pure mapping** for testability.
- Document **env toggles** (`MAXFRAME_FAKE_VIDEO_METADATA`, `YT_DLP_PATH`).

---

## Deep research methodology

### Pass 1 — Landscape scan

Candidates grouped by **runtime shape**:

1. **Subprocess extractors:** yt-dlp (current), youtube-dl (superseded for most teams), gallery-dl (not YouTube-primary).
2. **In-process Node (InnerTube / scrapers):** youtubei.js, maintained ytdl-core forks, youtube-ext-class scrapers.
3. **Remote HTTP APIs:** Piped, Invidious, project-specific “Cobalt-style” REST services.
4. **Not extractors:** ffmpeg (mux/transcode **after** URLs exist), axios/fetch (transport only).

### Pass 2 — Documentation deep-dive (verified excerpts)

**youtubei.js — prerequisites and interpreter**

From [Getting Started](https://ytjs.dev/guide/getting-started):

- Node requires **Node.js 16.8+** (undici `fetch`); spec-compliant `ReadableStream` if using `VideoInfo#download`.
- **`retrieve_player` (default `true`):** “Disabling this will make session creation faster, but **deciphering formats will not be possible**.”
- **Custom JS interpreter:** “Some features, such as deciphering streaming URLs, require executing YouTube's obfuscated JavaScript code. **YouTube.js does not include a built-in interpreter** for this purpose, so **you must provide your own**.” Docs show wiring `Platform.shim.eval` (example uses `new Function(code)()` pattern).

**Implication for Electron:** main process can use Node, but **any `Function`/eval path** is a **security and supply-chain** decision; prefer **isolated-vm** or equivalent if you ship this to users.

**npm package metadata (youtubei.js)**

From [npmjs.com/package/youtubei.js](https://www.npmjs.com/package/youtubei.js) (fetched 2026-04-24):

- Version line cited on page: **17.0.1** (publish date shown as Mar 16, 2026 on npm page).
- **Weekly Downloads:** ~**89.3k**; **Dependents:** **97**; **License:** MIT; unpacked size large (~14MB) — affects bundle discipline if imported into renderer (should stay **main-only**).

**@distube/ytdl-core — maintenance status**

From [raw README](https://raw.githubusercontent.com/distubejs/ytdl-core/master/README.md):

- “**This fork will be no longer maintained.** Please use alternatives (e.g. **youtubei.js**) instead.” DisTube’s `@distube/youtube` depends on youtubei.js.

**yt-dlp — community scale**

From [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) landing (fetched 2026-04-24): on the order of **158k+** stars — proxy for ecosystem momentum and patch velocity.

**Piped — API surface**

From [Piped API documentation](https://docs.piped.video/docs/api-documentation/):

- Unauthenticated **`/streams/:videoId`** returns JSON including **`videoStreams`** and **`audioStreams`** with fields such as `quality`, `format`, `mimeType`, `url`, `fps`, `height`, `width`, `videoOnly`, plus optional `dash` / `hls` URLs.
- Docs note public instances list and that clients should **parse instances dynamically**.

**Invidious — API + fragility notes**

From [Invidious API docs](https://docs.invidious.io/api/) and related discussions: `GET /api/v1/videos/:id` exposes `formatStreams` and `adaptiveFormats`. GitHub issues (e.g. blank `formatStreams` / streamingData fallback) illustrate that **third-party servers still chase YouTube**; you inherit their patch lag.

### Pass 3 — Real-world validation (signals, not benchmarks)

| Signal | yt-dlp | youtubei.js | @distube/ytdl-core | Piped / Invidious |
|--------|--------|-------------|--------------------|-------------------|
| Maintenance explicitly active | Yes (high churn repo) | Yes (npm + docs) | **No (deprecated)** | Depends on instance |
| Security-sensitive JS execution | Inside yt-dlp binary process | **App must supply interpreter** | Varies by fork | Server-side |
| Operational burden for app team | Bundle/sign binary or require PATH | Dependency + VM policy | Low (deprecated) | **Host or trust remote** |

No independent download-speed benchmark was executed in this pass; **analyze latency** is still expected to be **network-bound** across all serious options.

### Pass 4 — Integration feasibility (Electron + current repo)

- **Main process only:** All real extractors should stay on **`ipcMain` / main** paths (already true for `analyzeVideoHandler`). Avoid bundling youtubei.js into **renderer** (bundle size + exposure surface).
- **IPC errors:** Custom `Error` objects may lose structure across IPC; user-visible strings should remain clear for “missing binary” vs “YouTube blocked request.”
- **yt-dlp today:** `execFile` + large `maxBuffer` for `-J` JSON — align with eventual **download** IPC (progress, cancel, temp paths).
- **youtubei.js path:** Add `YoutubeIjsVideoMetadataGateway`, map InnerTube format objects → `QualityOption[]`, feature-flag vs yt-dlp, golden tests vs `-J` output.
- **Piped path:** `axios`/`fetch` to configured base URL + `streams/:id`; map `videoStreams` → `QualityOption[]`; handle **instance rotation**, **rate limits**, and **TLS pinning** policy if user-configured instances are allowed.

---

## External solutions (consolidated catalog)

### A. yt-dlp (CLI) — current default

**Pros:** Breadth, JSON `-J`, cookies/pass-through parity, non-YouTube extractors.  
**Cons:** Subprocess + binary distribution.  
**Fit:** **High** for Maxframe v1.

### B. youtubei.js (LuanRT / InnerTube)

**Pros:** No subprocess; rich API; strong npm traction.  
**Cons:** **Interpreter shim** for deciphering; **large** dependency; YouTube-only.  
**Fit:** **High** *if* team accepts VM/security work and ongoing InnerTube churn in JS.

### C. Maintained ytdl-core forks (e.g. @ybd-project/ytdl-core)

**Pros:** Stream-oriented API familiar to Node devs.  
**Cons:** Fragmentation; verify each fork’s roadmap **against** DisTube deprecation signal.  
**Fit:** **Medium** — due diligence required.

### D. youtube-ext and similar scrapers

**Pros:** Often marketed as fast.  
**Cons:** Same **eval/VM** theme; treat as **high security scrutiny**.  
**Fit:** **Low–Medium** default.

### E. gallery-dl / streamlink

**Pros:** Excellent in non-YouTube niches.  
**Cons:** YouTube completeness still favors yt-dlp for generic downloaders.  
**Fit:** **Low** as **primary** YouTube extractor.

### F. Remote APIs — Piped (documented)

**Pros:** Clean REST, separates concerns.  
**Cons:** Privacy, trust, instance availability, abuse policy, mapping maintenance.  
**Fit:** **Medium** for “thin client” or internal tool with **self-hosted** backend.

### G. Remote APIs — Invidious (and similar)

**Pros:** Mature API shapes; self-hostable.  
**Cons:** Same trust/ops issues; historical **empty/partial format** bugs show dependency on server version.  
**Fit:** **Medium**, similar to Piped.

### H. “Cobalt-style” public extractors

**Pros:** Extremely thin client.  
**Cons:** Highest **trust + ToS + availability** risk for a desktop product; not detailed here—treat as **vendor diligence** if considered.

---

## Comparison matrix (deep)

| Criteria | yt-dlp | youtubei.js | ytdl-core forks (active) | Piped (self-hosted) | Invidious (self-hosted) |
|----------|--------|---------------|---------------------------|------------------------|----------------------------|
| YouTube parity / drift handling | High | High (app-owned) | Medium–High (fork-dependent) | Medium–High (server-owned) | Medium–High (server-owned) |
| Multi-site | High | Low | Low | Low | Low |
| Subprocess | Yes | No | No | No | No |
| User-data leaves device (default) | No | No | No | **Yes** (HTTP to server) | **Yes** |
| Electron main-process fit | High | High (with VM plan) | High | High | High |
| Deprecation risk (2026 check) | Low | Low | **Elevated for @distube fork** | Medium | Medium |

---

## Recommendations

### Primary recommendation (unchanged)

**Keep yt-dlp as default** until a hard requirement forces subprocess removal or bundling constraints change.

### Alternative A — In-process

Implement **youtubei.js** behind `VideoMetadataGateway` with:

1. **Interpreter policy** (no raw `Function` in production without isolation review).
2. **Golden URL tests** vs yt-dlp `-J` for format parity.
3. **Feature flag** + fallback to yt-dlp for regressions.

### Alternative B — Remote

Run **self-hosted Piped** (or similar) and a small `PipedVideoMetadataGateway` using **only** your instance URL — do **not** silently hard-code public instances for production users.

### Avoid

- New dependency on **@distube/ytdl-core** as a long-term core (explicitly unmaintained).
- Renderer-side extractors or eval.

---

## Open Questions

- Legal / ToS stance for downloader UX (out of scope for engineering research).
- Will Maxframe require **cookie import** parity with yt-dlp for restricted content?
- **Bundling:** yt-dlp + ffmpeg via `extraResources` vs user-managed installs.
- **Telemetry:** whether to log extractor choice failures (privacy review).

---

## Sources (deep research)

| # | URL | Type | Reliability | Key finding |
|---|-----|------|-------------|-------------|
| 1 | https://github.com/yt-dlp/yt-dlp | Official repo | High | Very large community; CLI reference implementation class |
| 2 | https://ytjs.dev/guide/getting-started | Official docs | High | `retrieve_player` tradeoff; **must provide JS interpreter** for deciphering |
| 3 | https://raw.githubusercontent.com/LuanRT/YouTube.js/main/README.md | Official readme | High | InnerTube scope, MIT, npm install path |
| 4 | https://www.npmjs.com/package/youtubei.js | Registry metadata | High | Weekly downloads ~89.3k; dependents 97; version info |
| 5 | https://raw.githubusercontent.com/distubejs/ytdl-core/master/README.md | Upstream readme | High | **Fork unmaintained**; migrate to youtubei.js |
| 6 | https://docs.piped.video/docs/api-documentation/ | Official API docs | High | `/streams/:videoId` schema for remote gateway option |
| 7 | https://docs.invidious.io/api/ | Official API docs | High | Video JSON shape; understand server-side fragility |
| 8 | https://github.com/iv-org/invidious/issues/5420 | Issue discussion | Medium | Example of `formatStreams` / fallback drift |

---

## Confidence assessment

**Overall confidence:** **Medium–High** for *directional* recommendations; **Medium** for performance ordering without benchmarks.

**Reasoning:** Primary sources were official docs/registries; no hands-on A/B timing of extractors in Maxframe’s Electron build was performed.

**Gaps:**

- No benchmarked cold-start / full-analyze timing (yt-dlp vs youtubei.js) on Windows CI hardware.
- No legal review.
- Cobalt-style public APIs not deeply audited (intentionally).

**Suggested spike (2–4 hours):**

1. Branch: `YoutubeIjsVideoMetadataGateway` + `Innertube.create()` with **default** interpreter policy documented as “dev only.”
2. For **5 fixed video IDs**, dump youtubei.js format list and compare to `yt-dlp -J` (height/fps/itag/format_id mapping).
3. Document CPU/memory delta in main process (DevTools or simple logging).

---

## Next Steps

1. Review this document with product goals (local-first vs hosted API).
2. If subprocess removal is mandatory: execute **Suggested spike** and security review for VM.
3. If remote API: produce **threat model** (instance trust, TLS, URL logging).
4. Update `spec.md` to v0.2 when one path is selected as canonical.

---

## Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.2.0 | 2026-04-24 | research --deep | Replaced standard note with deep pass: verified docs/npm/repo signals, Piped/Invidious API notes, DisTube deprecation, confidence + spike. |

---

*Research completed with SDD 5.0 (deep mode).*
