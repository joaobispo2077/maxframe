# Research: Windows Installer Size and `CSC_IDENTITY_AUTO_DISCOVERY`

**Date:** 2026-04-25  
**Mode:** Deep  
**Status:** Complete

---

## Executive Summary

The `~100 MB` release asset and the `~390.6 MB` installer "required space" are both expected for the current Electron packaging model. They measure different things:

- `Maxframe-3.1.0-win-x64.exe` is a **compressed NSIS installer** (~101 MB).
- The NSIS wizard’s required space (~390.6 MB) reflects the **installed/unpacked app footprint**.

From local build artifacts, the installed footprint is driven mostly by Electron runtime binaries plus all Chromium locale packs, with app code as another substantial chunk.  
`CSC_IDENTITY_AUTO_DISCOVERY=false` does **not** make the app bigger or smaller; it controls certificate auto-discovery/signing behavior.

---

## What We Measured in This Repo

### Release/build artifacts

- Installer artifact: `dist/Maxframe-3.1.0-win-x64.exe` = **106,271,204 bytes** (~101.35 MiB)
- Unpacked app footprint: `dist/win-unpacked` = **409,548,861 bytes** (~390.58 MiB)
- This matches your installer dialog (`390.6 MB`) almost exactly.

### Largest files in `dist`

- `dist/win-unpacked/Maxframe.exe` = **222,836,736 bytes** (~212.52 MiB)
- `dist/Maxframe-3.1.0-win-x64.exe` = **106,271,204 bytes** (~101.35 MiB)
- `dist/win-unpacked/resources/app.asar` = **49,540,430 bytes** (~47.25 MiB)
- `dist/win-unpacked/dxcompiler.dll` = **25,664,512 bytes** (~24.48 MiB)
- `dist/win-unpacked/LICENSES.chromium.html` = **19,472,684 bytes** (~18.57 MiB)
- `dist/win-unpacked/icudtl.dat` = **10,822,192 bytes** (~10.32 MiB)

### Locale payload

- `dist/win-unpacked/locales` total = **48,600,130 bytes** (~46.35 MiB)

This is one of the clearest optimization levers.

### `extraResources` payload right now

`buildResources` total in repo is tiny (~0.16 MB), and packaged `resources/ffmpeg` + `resources/yt-dlp` are effectively placeholder-sized in this build.  
So the current 390 MB is **not** caused by bundled ffmpeg/yt-dlp binaries today.

---

## Does `CSC_IDENTITY_AUTO_DISCOVERY=false` Need to Be False?

Short answer: **for your current unsigned release flow, yes, keeping it false is reasonable**.  
Long answer:

- `CSC_IDENTITY_AUTO_DISCOVERY` controls whether electron-builder auto-discovers signing identities (especially on macOS keychain setups).
- It is about **signing identity discovery**, not runtime payload size or installer compression ratio.
- In your repo, this flag is used to avoid accidental certificate discovery/sign attempts in CI/local automation where no intentional signing cert is configured.

So:
- **Keep it `false`** while intentionally shipping unsigned Windows artifacts.
- Change strategy only when you move to managed certificate-based signing.

Sources:
- [electron-builder code signing setup](https://www.electron.build/code-signing.html)
- [electron-builder config docs](https://www.electron.build/configuration.html)

---

## Why 100 MB Download vs 390 MB Installed?

Because NSIS installer is compressed and the install target is decompressed.

- NSIS (LZMA) can compress many app/runtime files heavily, so download size is much lower.
- Installed size reflects full extracted Electron runtime + app resources.
- Your measured values line up exactly with this behavior.

Source:
- [electron-builder NSIS docs](https://www.electron.build/nsis.html)

---

## What Other Electron Tools/Apps Typically Do

Most Electron apps accept a relatively large installed footprint because they ship Chromium + Node runtime.  
Common practice is to optimize where practical (language packs, dependency pruning, splitting optional binaries), but not to expect "native app tiny" sizes.

General reference:
- [Electron distribution model](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

---

## Practical Options to Reduce Size (Ranked)

## Option 1: Restrict Electron locales (Highest impact, low-medium risk)

Use `electronLanguages` to keep only required languages (for example, `en-US` and maybe `pt-BR`).

Why it matters:
- You currently ship ~46 MB of locales.
- This is likely the fastest safe win.

Potential gain:
- Roughly tens of MB (often 30-45 MB range, depending on final language set).

Source:
- [electron-builder configuration (`electronLanguages`)](https://www.electron.build/configuration.html)

## Option 2: Audit `app.asar` composition (Medium impact, medium risk)

`app.asar` is ~47 MB. Verify if unused UI/dependency payload is being included in production bundle.

Targets:
- Reduce large frontend/library payloads
- Ensure only runtime-required files are packed
- Validate workspace package `"files"` fields are minimal

Potential gain:
- 10-30+ MB depending on dependency cleanup and bundling efficiency.

## Option 3: Keep current NSIS but add lightweight distribution mode (Medium impact, low risk)

`nsis-web` reduces initial installer download size by moving package retrieval online (useful if download size is the pain point).  
It does **not** magically reduce installed footprint.

Source:
- [electron-builder NSIS web installer](https://www.electron.build/nsis.html)

## Option 4: Make heavy binaries optional/on-demand (High impact later, medium-high product risk)

If/when real ffmpeg/yt-dlp binaries are bundled, they can dramatically increase size.  
A staged download approach can keep installer lean but adds runtime complexity, offline concerns, and integrity/update handling.

---

## Recommended Path for Maxframe

1. Keep `CSC_IDENTITY_AUTO_DISCOVERY=false` (no size downside; aligns with unsigned release intent).
2. Add `electronLanguages` with minimal supported languages.
3. Measure before/after on:
   - installer `.exe` size
   - `win-unpacked` size
   - installer reported required space
4. If still too large, run focused `app.asar` slimming pass (dependency and bundle audit).

## Measurement checklist (Windows)

- Installer size: `dist/Maxframe-*-win-x64.exe`
- Installed footprint: `dist/win-unpacked/`
- Locale payload: `dist/win-unpacked/locales/`
- App bundle payload: `dist/win-unpacked/resources/app.asar`

PowerShell examples:

- `Get-Item dist\\Maxframe-*-win-x64.exe | Select-Object Name,Length`
- `(Get-ChildItem dist\\win-unpacked -Recurse -File | Measure-Object Length -Sum).Sum`
- `(Get-ChildItem dist\\win-unpacked\\locales -Recurse -File | Measure-Object Length -Sum).Sum`
- `(Get-Item dist\\win-unpacked\\resources\\app.asar).Length`

## PR quality signal (Size Limit)

- Workflow: `.github/workflows/size-limit.yml`
- Trigger policy: PRs only on release flow (`feature/* -> dev`, `dev -> release`)
- Reporting policy: sticky PR comment only (source of truth), non-blocking
- Config baseline: `.size-limit.json` with a total built-JS limit of **500 kB**

---

## Open Questions

- Which languages do you want to officially support in Windows builds?
- Is your priority lower download size (`nsis-web`) or lower installed footprint?
- Do you plan to bundle real ffmpeg/yt-dlp binaries in phase 1 or download on demand?

---

## Bundle size QC: [Size Limit](https://github.com/ai/size-limit) vs [bundlewatch](https://www.npmjs.com/package/bundlewatch)

Both tools help stop accidental bundle bloat in CI. They optimize for different shapes of project.

### Size Limit (recommended for Maxframe)

**What it fits:** Apps that already ship a bundler output (Vite here). Use the **`@size-limit/file`** plugin to measure **real files on disk** (by default **Brotli-compressed** size), which matches “what users pay over the wire” for JS chunks better than raw bytes alone.

**Why it fits this repo:**

- You have **multiple artifacts** (renderer under `packages/renderer/dist/`, main under `packages/main/dist/`, preload `.mjs` under `packages/preload/dist/`). Size Limit supports **several named checks** in one config (`size-limit` in root `package.json` or `.size-limit.json`).
- Official workflow story: PR comments via [Size Limit’s GitHub Action pattern](https://github.com/ai/size-limit#reports) (e.g. `andresz1/size-limit-action`).

**`--why` (dependency / internal cost):**

- Size Limit documents `--why` with **Statoscope-style** reports when you add **`@size-limit/esbuild-why`** or **`@size-limit/webpack-why`** alongside the bundler plugin path ([Size Limit README — Analyze with `--why`](https://github.com/ai/size-limit#analyze-with---why)).
- For **pre-built Vite output**, the **`file` plugin alone** measures sizes; **`--why` is oriented around** the **esbuild/webpack** analysis path. Practical split:
  - **CI gate:** `@size-limit/file` on the built `dist/**` globs you care about.
  - **Local “why”:** either add a **small esbuild entry** that mirrors your public imports (if you adopt `@size-limit/esbuild` + `@size-limit/esbuild-why`), or keep using **Vite’s bundle analyzer** (`rollup-plugin-visualizer`) for chunk-level drilldown on the same build you already produce.

**Suggested first checks (after `npm run build`):**

- Renderer: `packages/renderer/dist/assets/**/*.js` (adjust if your build emits different layout).
- Main: `packages/main/dist/index.js` (or the actual entry filename).
- Preload: `packages/preload/dist/**/*.mjs`.

Set **limits** slightly above today’s measured values, then tighten over time.

### bundlewatch

**What it fits:** Often a **single** or few **known URLs** or files, compared to a **baseline** on the default branch (max size per file, CI fails on regression).

**Tradeoffs vs Size Limit here:**

- **Pros:** Very small config surface; good when you already upload one `stats.json` or one bundle URL from CI.
- **Cons:** Less natural for **multi-package Electron** layouts; **no first-class `--why`** equivalent—you still pair it with Webpack Stats or another analyzer for explanations.

### Recommendation

Adopt **Size Limit + `@size-limit/file`** in CI for **budgets on built JS** after `npm run build`. Treat **`--why`** as an **on-demand** analysis path (esbuild-why or Vite visualizer), not necessarily every PR, to keep CI time predictable.

---

## Sources

1. [Release v1.0.0 asset context](https://github.com/joaobispo2077/maxframe/releases/tag/v1.0.0)  
2. [electron-builder: Code signing setup](https://www.electron.build/code-signing.html)  
3. [electron-builder: Common configuration](https://www.electron.build/configuration.html)  
4. [electron-builder: NSIS target](https://www.electron.build/nsis.html)  
5. [Electron: Application distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution)  
6. [Size Limit](https://github.com/ai/size-limit) — performance budgets, `--why`, CI reporting  
7. [bundlewatch](https://www.npmjs.com/package/bundlewatch) — baseline file-size checks in CI
