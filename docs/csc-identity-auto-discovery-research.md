# Research: `CSC_IDENTITY_AUTO_DISCOVERY=false` in Maxframe CI

**Date:** 2026-04-25  
**Mode:** Deep research  
**Scope:** Determine whether `CSC_IDENTITY_AUTO_DISCOVERY=false` is really needed, compare common behavior in other desktop packaging toolchains, and explain practical impact.

---

## Executive Summary

For this repository, keeping `CSC_IDENTITY_AUTO_DISCOVERY=false` in Windows build paths is reasonable and low-risk. It clearly expresses that this phase ships unsigned installers and avoids accidental certificate/keychain probing behavior when environments change.

The flag itself is historically documented around macOS keychain identity discovery, but in practice teams use it as a "do not auto-pick signing identity" guardrail in CI scripts. In Maxframe specifically, the stronger control is still your explicit build strategy in `electron-builder.mjs` (`signAndEditExecutable` behavior) and the absence of certificate secrets in the Windows job.

Other ecosystems (Tauri, Electron Forge) generally prefer explicit cert provisioning via secrets/variables and explicit signing configuration. Their default pattern is "sign only when credentials are intentionally provided", not "auto-discover whatever exists".

---

## Current Maxframe Behavior (Internal)

### What the repo currently does

- `package.json` -> `compile:win` sets `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- `.github/workflows/release.yml` Windows installer step sets:
  - `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`
  - `GH_TOKEN` / `GITHUB_TOKEN` for electron-builder publish metadata behavior.
- `electron-builder.mjs` controls executable editing/signing path with:
  - `useFullWinExecutableEdit = CI === 'true' || MAXFRAME_WIN_FULL_PE === '1'`
  - `win.signAndEditExecutable: useFullWinExecutableEdit`

### Why this matters operationally

For this project, the flag is mainly a safety declaration:

1. We are intentionally not doing cert-based code-signing in this phase.
2. Builds should remain deterministic across local + CI without relying on host cert stores.
3. Future environment drift (e.g., self-hosted runner with certificates present) should not silently change signing behavior.

---

## What Electron Builder Docs Actually Say

### `CSC_IDENTITY_AUTO_DISCOVERY`

Electron-builder's explicit documentation for this env var is clearest in macOS signing docs:

- To disable signing, leave cert vars unset and set `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Alternative: set `mac.identity=null`.

On Windows docs, electron-builder emphasizes explicit cert configuration and discusses EV vs regular code-sign cert realities in CI (e.g., EV token constraints).

### Important related behavior

Electron-builder publish behavior is token-driven:

- If `GH_TOKEN` or `GITHUB_TOKEN` is present, publish provider defaults to GitHub.
- Implicit publishing behavior is deprecated and v27 expects explicit `--publish` or config.

This is relevant because teams often conflate "signing failed" with "publishing failed", but in recent CI issues those are often separate concerns.

---

## What Other Toolchains Commonly Do

### Tauri

Typical pattern:

- Provide signing material explicitly via secrets and env vars.
- Import/decode cert in CI only when signing is intended.
- Keep CI behavior explicit, not auto-discovery based.

### Electron Forge

Typical pattern:

- Configure signer explicitly at packaging/make step.
- Use env vars/secrets for `certificateFile`/password or Azure Trusted Signing settings.
- Keep secrets out of source and wire signing intentionally.

### Practical comparison

- **electron-builder with auto-discovery enabled:** can be convenient locally but may create ambiguity in mixed environments.
- **explicit-signing pattern (Tauri/Forge style):** clearer and more predictable in CI pipelines.

---

## Is `CSC_IDENTITY_AUTO_DISCOVERY=false` Really Needed Here?

### Short answer

Not strictly required for Windows-only unsigned builds to succeed every time, but recommended as a clarity/safety control in this repo.

### Why keep it

- Documents intent: "unsigned build expected".
- Reduces chance of accidental cert-store coupling.
- Keeps local and CI scripts aligned with current release policy.

### When to remove it

Remove only when you intentionally move to explicit Windows signing (e.g., PFX secret or Azure Trusted Signing) and have updated CI to provide cert credentials and deterministic signer config.

---

## Recommended Policy for Maxframe

1. Keep `CSC_IDENTITY_AUTO_DISCOVERY=false` for now.
2. Add explicit publish mode in build/release commands before electron-builder v27 migration (avoid deprecated implicit publish behavior).
3. When moving to signed releases:
   - choose cert strategy (regular cert or Azure Trusted Signing),
   - wire explicit env secrets,
   - document fallback and failure modes in `docs/releasing-windows.md`.

---

## Risks and Misconceptions

- **Misconception:** "`CSC_IDENTITY_AUTO_DISCOVERY=false` disables all Windows signing logic."
  - Reality: it primarily controls identity auto-discovery semantics; full behavior still depends on broader builder config and available credentials.
- **Misconception:** "If build fails with token errors, it is a signing issue."
  - Reality: token failures may be publish provider auto-detection (`GH_TOKEN`/`GITHUB_TOKEN`) unrelated to certificate signing.

---

## Decision

For current phase (unsigned Windows release flow), keep:

- `CSC_IDENTITY_AUTO_DISCOVERY=false` in `compile:win` and workflow step.

And plan next:

- explicit publish config hardening (`--publish`/config) ahead of electron-builder v27 expectations.

---

## Sources

- Electron-builder macOS code-signing docs: <https://electron.build/code-signing-mac.html>
- Electron-builder Windows signing docs: <https://electron.build/code-signing-win.html>
- Electron-builder publish docs: <https://electron.build/publish>
- Tauri Windows signing guide: <https://tauri.app/v1/guides/distribution/sign-windows/>
- Electron Forge Windows signing guide: <https://www.electronforge.io/guides/code-signing/code-signing-windows>
- Electron-builder issue discussion on `CSC_IDENTITY_AUTO_DISCOVERY`: <https://github.com/electron-userland/electron-builder/issues/7515>
