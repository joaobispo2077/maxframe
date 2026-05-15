## [1.3.1](https://github.com/joaobispo2077/maxframe/compare/v1.3.0...v1.3.1) (2026-05-15)


### Bug Fixes

* **download:** stream yt-dlp progress on carriage returns ([e3de9ad](https://github.com/joaobispo2077/maxframe/commit/e3de9adee33a813dbf6627b435357bc2401dc929))

# [1.3.0](https://github.com/joaobispo2077/maxframe/compare/v1.2.0...v1.3.0) (2026-05-14)


### Bug Fixes

* **renderer:** migrate tsconfig paths off baseUrl ([fc41058](https://github.com/joaobispo2077/maxframe/commit/fc4105804a481543f739616bcebb3d42c58ded8b))
* **preload:** remove duplicate showItemInFolder export ([297190d](https://github.com/joaobispo2077/maxframe/commit/297190d345ed4baf8acede1c44e7450bee4adbaa))


### Features

* **ipc:** add app:show-item-in-folder channel ([5461357](https://github.com/joaobispo2077/maxframe/commit/54613572051bc1af3fd43e142038fb84f42e87ce))
* **ui:** resolution-first quality list and open-folder button on download banner ([ced754e](https://github.com/joaobispo2077/maxframe/commit/ced754eaacf1129d311115cff0360eb587d2b464))

# [1.2.0](https://github.com/joaobispo2077/maxframe/compare/v1.1.0...v1.2.0) (2026-04-26)


### Bug Fixes

* **bundle-binaries:** add getLogPath to MaxframeApi type and all test/Cypress mocks ([d276842](https://github.com/joaobispo2077/maxframe/commit/d276842ae38e3fb26c6bceb4b5f70bbc6e6a6382))
* **ui-identity:** show 0% during waiting stage instead of hiding percentage ([7e85b8b](https://github.com/joaobispo2077/maxframe/commit/7e85b8b6c3beed0e4e8de8137415f8265296ca82))


### Features

* **ui-identity:** extend InitialAppState with isPortable flag ([57a995f](https://github.com/joaobispo2077/maxframe/commit/57a995ff789473e5a0855adcd574792fc6616a82))
* **bundle-binaries:** pass --ffmpeg-location to yt-dlp so bundled ffmpeg is always used for merge and audio extraction ([bed3d76](https://github.com/joaobispo2077/maxframe/commit/bed3d76e1763d5bc006f423e1a0d05ded6c1da14))
* **ui-identity:** replace Vite favicon with Maxframe logo and fix HTML title ([ed428f2](https://github.com/joaobispo2077/maxframe/commit/ed428f2399ee83ee6364427534e970f3163b7bf7))
* **ui-identity:** set Maxframe window title, remove native menu, load app icon ([12dff68](https://github.com/joaobispo2077/maxframe/commit/12dff681177011169b6bea71fb05cc33de644c1e))
* **bundle-binaries:** show debug log file path with copy button in Settings when debug mode is on ([cdc9bac](https://github.com/joaobispo2077/maxframe/commit/cdc9bac387d615a689f9211394c6a9b23bc41e4d))
* **ui-identity:** show Portable badge and add entry animations for quality list and progress card ([18c111d](https://github.com/joaobispo2077/maxframe/commit/18c111d1c833ab4333e189a07b3cc8a006aa7a76))

# [1.1.0](https://github.com/joaobispo2077/maxframe/compare/v1.0.1...v1.1.0) (2026-04-26)

### Bug Fixes

- **cypress:** add [@src](https://github.com/src) alias to Cypress Vite config so renderer components resolve domain imports ([0f66911](https://github.com/joaobispo2077/maxframe/commit/0f6691149c87a16e839cbac9ca63b9dbbbde5b19))
- **ci:** align size-limit workflow with develop/release flow ([73d7e2d](https://github.com/joaobispo2077/maxframe/commit/73d7e2de83c5231da2b4e499d8c07acd1f0c24c0))
- **portable:** correct electron-builder portable config key and compile script target syntax ([50b1594](https://github.com/joaobispo2077/maxframe/commit/50b159453822e86e9427b9cfd6c30f0b5485a03f))
- **renderer:** include outputMode in HomePage downloads ([2c9f56e](https://github.com/joaobispo2077/maxframe/commit/2c9f56e27292e0784a93b8df522a1c4d3796a54d))
- **typescript:** resolve tsconfig deprecation noise in editor ([187c6d0](https://github.com/joaobispo2077/maxframe/commit/187c6d0d33ed43c9bb44e3466c64980114dc5535))
- **infra:** set yt-dlp cwd to output directory to avoid temp files in project root ([7aa6e63](https://github.com/joaobispo2077/maxframe/commit/7aa6e63fca3bb371f6ebc34f0aac521b0058e350))
- **build:** use customUnInstall macro for NSIS uninstall hook ([79eebd4](https://github.com/joaobispo2077/maxframe/commit/79eebd4979c864acbdfd59574b6fe99b7bc85f26))

### Features

- **domain:** add audio quality ranking policy ([de68b33](https://github.com/joaobispo2077/maxframe/commit/de68b33faaf8513b149940b9a8df24a7719c32fb))
- **diagnostics:** add debug mode with diagnostic panel and log file ([341af2e](https://github.com/joaobispo2077/maxframe/commit/341af2e86648693bdc0d287520088e9ba556f428))
- **renderer:** add DownloadProgressCard and AnalyzingIndicator components ([7a2693e](https://github.com/joaobispo2077/maxframe/commit/7a2693efb0e3b7f5e7c4102bd1c77554f936e6ad))
- **infra:** add MP3 output mode to format selector, yt-dlp runner and filename builder ([54200b1](https://github.com/joaobispo2077/maxframe/commit/54200b17920672927c313d8d093a5b6591238348))
- **ui:** add output format selector with MP3 audio-only and MP4 best-video flows ([f92eeb5](https://github.com/joaobispo2077/maxframe/commit/f92eeb59eaca886018dddf49a8bdd9c598483179))
- **ipc:** add outputMode to download request and branch MP3/MP4 handler ([f5eac9a](https://github.com/joaobispo2077/maxframe/commit/f5eac9a00a2f7074ff34d468fe4a9ea7af928820))
- **renderer:** add useDownloadProgress hook with 800ms done-flash and cancel support ([a400dd4](https://github.com/joaobispo2077/maxframe/commit/a400dd494b495c440cf6b179874fd4aa3db65426))
- **domain:** add yt-dlp progress line parser with stage detection ([fdd8b8a](https://github.com/joaobispo2077/maxframe/commit/fdd8b8ad51419d7add6c6079fd86a55ac00f70b9))
- **infra:** enrich metadata gateway with title, uploader and audio streams ([c483b6b](https://github.com/joaobispo2077/maxframe/commit/c483b6befa67e2499d66861b9f2eab25c4fa24a1))
- **app:** extend AnalyzeVideoUrlUseCase with title, uploader and audio qualities ([6cde15e](https://github.com/joaobispo2077/maxframe/commit/6cde15ef713f6e328fd2718f5e902db7824a08ed))
- **portable:** redirect userData to exe dir and disable auto-updater in portable mode ([de8fd97](https://github.com/joaobispo2077/maxframe/commit/de8fd97750ce45e2bf390ba38d0bbbe9d26b1141))
- **renderer:** replace raw progress log with structured DownloadProgressCard and AnalyzingIndicator ([7c10968](https://github.com/joaobispo2077/maxframe/commit/7c10968b6981a4e68b06b9c07717ef8a7f2a9fcf))

## [1.0.1](https://github.com/joaobispo2077/maxframe/compare/v1.0.0...v1.0.1) (2026-04-26)

### Bug Fixes

- **smoke:** handle empty args in fallback launch ([9ee3228](https://github.com/joaobispo2077/maxframe/commit/9ee3228b48ea08f0707e1a4ac20ee307366b9bfc))
- **smoke:** harden Windows installer gate with diagnostics ([582b156](https://github.com/joaobispo2077/maxframe/commit/582b156e10654616134227253390476f6c766a7e))
- **smoke:** make Windows app launch check CI-safe ([b3499a7](https://github.com/joaobispo2077/maxframe/commit/b3499a77b4546ef36812b2cf4d45a7a0ac052e25))
- **build:** shrink packaged payload and add PR size reporting ([b1483c9](https://github.com/joaobispo2077/maxframe/commit/b1483c9feb89dec8ec08605725180fec66fa61e4))
- **release:** stabilize Windows smoke installer execution ([cacb4c2](https://github.com/joaobispo2077/maxframe/commit/cacb4c2c58fd61979a180dbd7afb40e4ebdf3921))

# 1.0.0 (2026-04-25)

### Bug Fixes

- **release:** add on-demand installer smoke workflow and harden smoke script ([6713398](https://github.com/joaobispo2077/maxframe/commit/67133988327073b56b4ba73fed9b5c68bcd1b062))
- **release:** document token source differences in workflow ([86f4ea7](https://github.com/joaobispo2077/maxframe/commit/86f4ea779085ebae776b746fd73d3130b6d70423))
- **ci:** guard maxframeApi in download progress hook; align Stryker break threshold ([3cab053](https://github.com/joaobispo2077/maxframe/commit/3cab0537c4e54dc98672d2e086f189298608aa45))
- **lint:** ignore stryker temp sandbox files ([0a60a31](https://github.com/joaobispo2077/maxframe/commit/0a60a31c01a39d0433296ecfd9796c8f90624e31))
- **renderer:** improve text and surface contrast on dark shell ([ddcd6fc](https://github.com/joaobispo2077/maxframe/commit/ddcd6fc5f9bc9e8db50686a539df791467b85397))
- **ci:** run Vitest coverage via workspace script ([90a7ab2](https://github.com/joaobispo2077/maxframe/commit/90a7ab27ae5809c28573b84ef90c3abbc226de98))
- **renderer:** silence TS6 baseUrl deprecation in build config ([d5e1e34](https://github.com/joaobispo2077/maxframe/commit/d5e1e3488dd9d7fb792cd9f37997e89ad3833f4f))
- **testing:** stabilize ffmpeg bundled test and narrow mutation scope ([b6c90f7](https://github.com/joaobispo2077/maxframe/commit/b6c90f7fc72a2f36503e97d52b5a7ee64de34e7f))

### Features

- **app:** add analyze flow through ipc and renderer ([c531034](https://github.com/joaobispo2077/maxframe/commit/c53103429af92fc7c9edd43ab21f95b3d15b2832))
- **domain:** add quality ranking core and project constitution ([eeabeb3](https://github.com/joaobispo2077/maxframe/commit/eeabeb31b19b4073fed70ac7f3b30c38b2ee47f6))
- **renderer:** add Settings page shell and in-app navigation ([ec173ba](https://github.com/joaobispo2077/maxframe/commit/ec173badad8c7d3ea71c68fc9c3ee91d34037302))
- **core:** add VideoUrl validation and typed analyze errors ([d89d316](https://github.com/joaobispo2077/maxframe/commit/d89d31668ee0dafd68f1995c55834039477ed324))
- **metadata:** analyze YouTube formats with yt-dlp ([afca71a](https://github.com/joaobispo2077/maxframe/commit/afca71a72b8132c9c8ad52d2465933db2096dc41))
- bootstrap maxframe foundation with clean architecture and testing ([f916b26](https://github.com/joaobispo2077/maxframe/commit/f916b26c4d0a0038e6f502e6db890bb31b90eef3))
- **ipc:** download progress channel and cancel ([b824838](https://github.com/joaobispo2077/maxframe/commit/b8248381e8a37c626c8019cb8dd5f0f814441e8c))
- **ui:** download progress log, cancel, and tests ([81bf6cf](https://github.com/joaobispo2077/maxframe/commit/81bf6cf65adbb6cecec3bc7fe5b6ee7163ebac04))
- download progress, analyze flow, and yt-dlp integration updates ([094b8ea](https://github.com/joaobispo2077/maxframe/commit/094b8ea8c8236d45c434e54db8a764bfbd853bf2))
- **video-pipeline:** ffmpeg preflight, output paths, Chakra shell, docs ([f77536d](https://github.com/joaobispo2077/maxframe/commit/f77536d6693d9f6c371abeb0920ff12b7c33aa38))
- **build:** optional yt-dlp in extraResources and resolver paths ([f050f1f](https://github.com/joaobispo2077/maxframe/commit/f050f1f2998cb5826126f2bc7af641fd1c323f1f))
- **analyze:** parse YouTube video id and surface it in results ([5cb7b5e](https://github.com/joaobispo2077/maxframe/commit/5cb7b5e57f79e529f1dcac28a8fc19495973f002))
- **download:** stream yt-dlp with progress and optional cancel ([bd09e0e](https://github.com/joaobispo2077/maxframe/commit/bd09e0e4464e1234197a8ce6f36fdaaad8bc3b08))
- **ui:** transparency for quality list and vs-best compare ([0c601b9](https://github.com/joaobispo2077/maxframe/commit/0c601b977eb55ea339a1e796317e527305cd6726)), closes [#1](https://github.com/joaobispo2077/maxframe/issues/1)
- **download:** yt-dlp merge download via IPC and save dialog ([0fd67c1](https://github.com/joaobispo2077/maxframe/commit/0fd67c11f769874e690b7449c7349d5c005ba38d))

# Changelog

All notable changes to this project will be documented in this file.

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) on pushes to the `release` branch.

## [Unreleased]

Initial changelog placeholder; release notes will be appended here by semantic-release.
