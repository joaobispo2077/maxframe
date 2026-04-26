## [1.0.1](https://github.com/joaobispo2077/maxframe/compare/v1.0.0...v1.0.1) (2026-04-26)


### Bug Fixes

* **smoke:** handle empty args in fallback launch ([9ee3228](https://github.com/joaobispo2077/maxframe/commit/9ee3228b48ea08f0707e1a4ac20ee307366b9bfc))
* **smoke:** harden Windows installer gate with diagnostics ([582b156](https://github.com/joaobispo2077/maxframe/commit/582b156e10654616134227253390476f6c766a7e))
* **smoke:** make Windows app launch check CI-safe ([b3499a7](https://github.com/joaobispo2077/maxframe/commit/b3499a77b4546ef36812b2cf4d45a7a0ac052e25))
* **build:** shrink packaged payload and add PR size reporting ([b1483c9](https://github.com/joaobispo2077/maxframe/commit/b1483c9feb89dec8ec08605725180fec66fa61e4))
* **release:** stabilize Windows smoke installer execution ([cacb4c2](https://github.com/joaobispo2077/maxframe/commit/cacb4c2c58fd61979a180dbd7afb40e4ebdf3921))

# 1.0.0 (2026-04-25)


### Bug Fixes

* **release:** add on-demand installer smoke workflow and harden smoke script ([6713398](https://github.com/joaobispo2077/maxframe/commit/67133988327073b56b4ba73fed9b5c68bcd1b062))
* **release:** document token source differences in workflow ([86f4ea7](https://github.com/joaobispo2077/maxframe/commit/86f4ea779085ebae776b746fd73d3130b6d70423))
* **ci:** guard maxframeApi in download progress hook; align Stryker break threshold ([3cab053](https://github.com/joaobispo2077/maxframe/commit/3cab0537c4e54dc98672d2e086f189298608aa45))
* **lint:** ignore stryker temp sandbox files ([0a60a31](https://github.com/joaobispo2077/maxframe/commit/0a60a31c01a39d0433296ecfd9796c8f90624e31))
* **renderer:** improve text and surface contrast on dark shell ([ddcd6fc](https://github.com/joaobispo2077/maxframe/commit/ddcd6fc5f9bc9e8db50686a539df791467b85397))
* **ci:** run Vitest coverage via workspace script ([90a7ab2](https://github.com/joaobispo2077/maxframe/commit/90a7ab27ae5809c28573b84ef90c3abbc226de98))
* **renderer:** silence TS6 baseUrl deprecation in build config ([d5e1e34](https://github.com/joaobispo2077/maxframe/commit/d5e1e3488dd9d7fb792cd9f37997e89ad3833f4f))
* **testing:** stabilize ffmpeg bundled test and narrow mutation scope ([b6c90f7](https://github.com/joaobispo2077/maxframe/commit/b6c90f7fc72a2f36503e97d52b5a7ee64de34e7f))


### Features

* **app:** add analyze flow through ipc and renderer ([c531034](https://github.com/joaobispo2077/maxframe/commit/c53103429af92fc7c9edd43ab21f95b3d15b2832))
* **domain:** add quality ranking core and project constitution ([eeabeb3](https://github.com/joaobispo2077/maxframe/commit/eeabeb31b19b4073fed70ac7f3b30c38b2ee47f6))
* **renderer:** add Settings page shell and in-app navigation ([ec173ba](https://github.com/joaobispo2077/maxframe/commit/ec173badad8c7d3ea71c68fc9c3ee91d34037302))
* **core:** add VideoUrl validation and typed analyze errors ([d89d316](https://github.com/joaobispo2077/maxframe/commit/d89d31668ee0dafd68f1995c55834039477ed324))
* **metadata:** analyze YouTube formats with yt-dlp ([afca71a](https://github.com/joaobispo2077/maxframe/commit/afca71a72b8132c9c8ad52d2465933db2096dc41))
* bootstrap maxframe foundation with clean architecture and testing ([f916b26](https://github.com/joaobispo2077/maxframe/commit/f916b26c4d0a0038e6f502e6db890bb31b90eef3))
* **ipc:** download progress channel and cancel ([b824838](https://github.com/joaobispo2077/maxframe/commit/b8248381e8a37c626c8019cb8dd5f0f814441e8c))
* **ui:** download progress log, cancel, and tests ([81bf6cf](https://github.com/joaobispo2077/maxframe/commit/81bf6cf65adbb6cecec3bc7fe5b6ee7163ebac04))
* download progress, analyze flow, and yt-dlp integration updates ([094b8ea](https://github.com/joaobispo2077/maxframe/commit/094b8ea8c8236d45c434e54db8a764bfbd853bf2))
* **video-pipeline:** ffmpeg preflight, output paths, Chakra shell, docs ([f77536d](https://github.com/joaobispo2077/maxframe/commit/f77536d6693d9f6c371abeb0920ff12b7c33aa38))
* **build:** optional yt-dlp in extraResources and resolver paths ([f050f1f](https://github.com/joaobispo2077/maxframe/commit/f050f1f2998cb5826126f2bc7af641fd1c323f1f))
* **analyze:** parse YouTube video id and surface it in results ([5cb7b5e](https://github.com/joaobispo2077/maxframe/commit/5cb7b5e57f79e529f1dcac28a8fc19495973f002))
* **download:** stream yt-dlp with progress and optional cancel ([bd09e0e](https://github.com/joaobispo2077/maxframe/commit/bd09e0e4464e1234197a8ce6f36fdaaad8bc3b08))
* **ui:** transparency for quality list and vs-best compare ([0c601b9](https://github.com/joaobispo2077/maxframe/commit/0c601b977eb55ea339a1e796317e527305cd6726)), closes [#1](https://github.com/joaobispo2077/maxframe/issues/1)
* **download:** yt-dlp merge download via IPC and save dialog ([0fd67c1](https://github.com/joaobispo2077/maxframe/commit/0fd67c11f769874e690b7449c7349d5c005ba38d))

# Changelog

All notable changes to this project will be documented in this file.

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) on pushes to the `release` branch.

## [Unreleased]

Initial changelog placeholder; release notes will be appended here by semantic-release.
