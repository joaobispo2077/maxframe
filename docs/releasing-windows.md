# Gated Windows releases (phase 1)

**Phase 1** ships **NSIS for Windows x64** only. Portable zip and other platforms (macOS, Linux) are planned later. This matches [specs/active/release-distribution/plan.md](../specs/active/release-distribution/plan.md).

## Installer shape (`npm run compile:win`)

[electron-builder.mjs](../electron-builder.mjs) sets `productName: 'Maxframe'` and:

```text
artifactName: ${productName}-${version}-${os}-${arch}.${ext}
```

So a Windows x64 build produces, under `dist/`:

| File | Purpose |
|------|---------|
| `Maxframe-*-win-x64.exe` (resolved by `package.json` version) | NSIS installer (attached to the GitHub Release) |
| `*.blockmap` alongside the installer | Blockmap for `electron-updater` |
| `latest.yml` | Update metadata (when `generateUpdatesFilesForAllChannels` is enabled) |

**Workflows and CI** glob the installer with `*-win-x64.exe` (name is version-agnostic in scripts).

## CI vs local (`signAndEditExecutable` and `CI`)

- **GitHub Actions** sets `CI=true` on the Windows build job, so [electron-builder.mjs](../electron-builder.mjs) uses **full** Windows executable handling (rcedit, asar-integrity / winCodeSign as needed). That is what we ship: the release pipeline is **not** using the “skip PE edit” shortcut.
- **Local** runs do **not** set `CI`, so the same config defaults to **skipping** that step so `npm run compile:win` works on machines that cannot create the symlinks the winCodeSign 7z extract needs. To match CI on your PC, turn on **Windows Developer Mode** (or otherwise allow symlink creation) and run with `MAXFRAME_WIN_FULL_PE=1` for the `electron-builder` step (e.g. `$env:MAXFRAME_WIN_FULL_PE='1'; npm run compile:win` in PowerShell).
- `CSC_IDENTITY_AUTO_DISCOVERY=false` in `compile:win` and in the workflow only means **we are not using a code-signing certificate**; it does not replace the `CI` / `signAndEditExecutable` behavior above.

## End users (installer and Windows prompts)

Releases are **unsigned** in phase 1. Users should expect to **allow** the app to run and install in the usual Windows way:

- **SmartScreen** (“Windows protected your PC”): user chooses *More info* → *Run anyway* (or similar), or you later ship a **signed** installer.
- **UAC** / folder choice: the NSIS wizard (or silent `/D=…`) may require an account that can write to the chosen install path; per-user installs under `%LOCALAPPDATA%` need fewer admin prompts than per-machine `Program Files`.

## Local build and run

1. **Build:** from the repo root, `npm run compile:win` (uses `cross-env` to set `CSC_IDENTITY_AUTO_DISCOVERY=false` for the `electron-builder` step).
2. **Run the app without installing:** `dist\win-unpacked\Maxframe.exe`
3. **Test the NSIS flow:** run `dist\Maxframe-*-win-x64.exe` (e.g. double-click in Explorer) and go through the prompts above.

## Bundled yt-dlp and ffmpeg

Windows release builds use the same **`extraResources`** layout as in [electron-builder.mjs](../electron-builder.mjs): binaries from **`buildResources/yt-dlp/`** and **`buildResources/ffmpeg/`** are copied into **`resources/`** inside the packaged app. **Release maintainers** should place `yt-dlp.exe` and `ffmpeg.exe` in those folders **before** `npm run compile:win` so end users get a self-contained installer (see [buildResources/yt-dlp/README.txt](../buildResources/yt-dlp/README.txt) and [buildResources/ffmpeg/README.txt](../buildResources/ffmpeg/README.txt)).

**End users** of such a build normally do **not** install yt-dlp or ffmpeg separately. That is different from **local `npm start` development**, where developers still need tools on `PATH` or `YT_DLP_PATH` / `FFMPEG_PATH` — see the root [README.md](../README.md) section *yt-dlp and ffmpeg: packaged app vs local development*.

## NSIS silent install (smoke and automation)

- **Fully silent:** `/S`
- **Target directory (must be last on the command line in NSIS):** `/D=C:\path`  
  Documented in [scripts/windows-smoke-test.ps1](../scripts/windows-smoke-test.ps1).

## End-to-end pipeline (GitHub Actions)

1. **build-windows** on `windows-latest` — `npm run compile:win`, upload `dist/*-win-x64.exe` as a workflow artifact.
2. **smoke-windows** — download the artifact, run the NSIS silent install to `%RUNNER_TEMP%`, start `Maxframe.exe`, then exit 0.
3. **release** on `ubuntu-latest` — download the same artifact to `release-assets/`, run `npm run release` (semantic-release).  
   [release.config.mjs](../release.config.mjs) lists `release-assets/*-win-x64.exe` for `@semantic-release/github` when that folder contains the installer, so the Windows asset is only attached when the file is present (e.g. on CI after the download step).

`semantic-release` is configured for the **`release`** branch only. See [release.config.mjs](../release.config.mjs) and the **Release** section in the root [README.md](../README.md) for **`GH_TOKEN`**.

## On-demand installer smoke (manual)

- Use `.github/workflows/installer-smoke.yml` when you want to validate installer generation and smoke behavior from any branch.
- This workflow is **manual-only** (`workflow_dispatch`) and does not publish releases.
- It follows the same artifact handoff pattern as release: build installer artifact first, then run smoke against the downloaded artifact.
- The smoke script resolves `Maxframe.exe` recursively under the install prefix to avoid brittle assumptions about NSIS install layout.
- Smoke runs with `MAXFRAME_CI_SMOKE=1` to avoid non-essential startup noise (for example updater network checks) while preserving installer/startup validation.
- On smoke failure, workflows upload diagnostics from `${{ runner.temp }}/smoke-diagnostics` so failures can be triaged without rerun-only debugging.

## Version alignment

The build uses the `version` field in `package.json` at compile time, while `semantic-release` may bump the version on publish. In practice, merge meaningful releasable commits to `release` in the usual way so the tagged release and the built installer stay aligned. If you need a stricter “next version in the binary before the tag” flow, that is a follow-up (e.g. a dry-run version job).
