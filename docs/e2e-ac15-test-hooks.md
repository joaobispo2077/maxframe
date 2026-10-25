# AC15 app hooks (local fixture and test ids)

Playwright `_electron` will launch the packaged portable exe, paste a link, pick MP3, download, then download a video row. This page is the app side of that check. The workflow, the Playwright job, and `release.yml` are out of scope here.

The hook is inert unless test mode is on. There is no control in the UI that turns it on.

## Why two environment variables

The GUI test launches the real portable exe, so the hook has to be read at runtime. It cannot be compiled out of the build the test starts. A single fixture variable would also change a normal launch if that variable leaked into the environment. Test mode is a second, exact opt-in.

| Variable                  | Required value                                          | Effect when `MAXFRAME_E2E=1`                                                                                           |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MAXFRAME_E2E`            | exactly `1`                                             | Turns the hook on. `true`, `yes`, or `1` with spaces leave it off.                                                     |
| `MAXFRAME_E2E_FIXTURE`    | absolute path, or `file:` URL, of an existing file      | Analyze and download send yt-dlp a `file:///` URL for this file instead of the YouTube URL, plus `--enable-file-urls`. |
| `MAXFRAME_E2E_OUTPUT_DIR` | absolute path, or `file:` URL, of an existing directory | Analyze-tab downloads write here and skip the native save dialog.                                                      |

Any other combination keeps the normal YouTube path and the save dialog. In particular, `MAXFRAME_E2E_FIXTURE` alone does nothing.

When test mode is on and a path variable is set, the path must be local and must exist. Remote URLs and relative paths are rejected. A missing file, a directory used as the fixture, or a file used as the output directory fails the analyze or download with `E2eTestHookError` instead of falling through to YouTube.

The pasted link is still validated as a YouTube URL. The test can paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ`. After that check, yt-dlp receives a `file:///` URL for the fixture, not the bare path stored in `MAXFRAME_E2E_FIXTURE`. Format selection, `--extract-audio` / MP4 merge arguments, and `--ffmpeg-location` stay the same as a normal download. `--enable-file-urls` is added only while the fixture is active.

`MAXFRAME_E2E_FIXTURE` wins over `MAXFRAME_FAKE_VIDEO_METADATA`. The GUI job should not set the fake-metadata flag. Analyze reads the fixture instead of the fake catalog. For this sample, that read is one MP4 video row (`formatId` `mp4`) and no audio-only row. MP3 mode shows the fallback card. See the format table below.

If the download request already includes `outputDir` (the queue runner), that directory is used and `MAXFRAME_E2E_OUTPUT_DIR` is ignored.

## Fixture file

`tests/fixtures/e2e/sample.mp4` is a 2 second, 160x120 H.264 + AAC file (about 15 KB). Point `MAXFRAME_E2E_FIXTURE` at its absolute path, or generate a fresh one:

```bash
ffmpeg -y \
  -f lavfi -i "testsrc=duration=2:size=160x120:rate=10" \
  -f lavfi -i "sine=frequency=440:duration=2:sample_rate=22050" \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 45 \
  -c:a aac -b:a 32k -movflags +faststart -shortest \
  tests/fixtures/e2e/sample.mp4
```

The file needs both a video stream and an audio stream. ffprobe already reports H.264 (`avc1`) and AAC on `tests/fixtures/e2e/sample.mp4`. Regenerating that file does not change what yt-dlp returns: the generic extractor still leaves `vcodec` null and omits `acodec`. See the format table below.

## File URL passed to yt-dlp

`MAXFRAME_E2E_FIXTURE` stays an absolute filesystem path or a `file:` URL. `resolveYtdlpMediaUrl` turns the checked local path into a URL with `pathToFileURL` before analyze or download runs:

| Fixture path                | URL yt-dlp receives               |
| --------------------------- | --------------------------------- |
| `/tmp/maxframe/sample.mp4`  | `file:///tmp/maxframe/sample.mp4` |
| `C:\fixtures\sample.mp4`    | `file:///C:/fixtures/sample.mp4`  |
| `\\server\share\sample.mp4` | `file://server/share/sample.mp4`  |

A Windows drive path is not passed through as text. yt-dlp would read `C:` as a URL scheme. `pathToFileURL` with the Windows path rules produces `file:///C:/...` on every OS the unit tests run on.

While the fixture is active, both calls add `--enable-file-urls` immediately before that URL:

- Analyze: `-J`, `--no-warnings`, `--skip-download`, `--enable-file-urls`, then the `file:///` URL (`YtdlpVideoMetadataGateway`).
- Download: the usual format, output, ffmpeg, and merge arguments, then `--enable-file-urls`, then the same URL (`runYtdlpDownload`).

Normal mode never adds `--enable-file-urls`, including when a caller passes a `file:` URL without the fixture hook. Real yt-dlp 2026.08.19 rejects a bare path (`is not a valid URL`) and rejects a `file:` URL without the flag (`file:// URLs are disabled by default ... Use --enable-file-urls`).

## What the committed fixture produces

Measured with the pinned binary `2026.08.19` from `scripts/download-bundled-yt-dlp.mjs` (Linux asset `yt-dlp_linux`, SHA-256 checked against that release's `SHA2-256SUMS` after the pinned `yt-dlp.exe` hash matched):

```bash
yt-dlp -J --enable-file-urls "file:///absolute/path/tests/fixtures/e2e/sample.mp4"
```

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| extractor          | `generic`                                |
| title              | `sample`                                 |
| uploader           | absent (the app shows `Unknown Channel`) |
| format id          | `mp4` (one format)                       |
| ext                | `mp4`                                    |
| vcodec             | `null`                                   |
| acodec             | absent                                   |
| video_ext          | `mp4`                                    |
| audio_ext          | `none`                                   |
| width, height, fps | absent                                   |

`mapYtdlpFormatsToQualityOptions` treats a null video codec as no video and drops the format. `mapYtdlpAudioFormatsToQualityOptions` requires an audio codec, so it drops it too. Normal mode therefore still returns `videoQualities: []` and `audioQualities: []` for this JSON. That filtering is unchanged.

While the fixture hook is active (`MAXFRAME_E2E=1` and `resolveE2eFixture` active), analyze recognizes this exact shape — extractor `generic`, exactly one format, `format_id` `mp4`, `ext` `mp4`, `vcodec` null or absent — and returns one video row instead:

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| formatId           | `mp4`                                              |
| row type           | MP4 video row (`hasVideo: true`, `hasAudio: true`) |
| container          | `mp4`                                              |
| resolutionLabel    | `unknown`                                          |
| width, height, fps | `0`                                                |
| audioQualities     | `[]`                                               |

`hasAudio` stays true because `-f mp4` downloads the muxed file. The video-only selector (`mp4+bestaudio`) is not available for this format, so a video-only row would fail the MP4 download. MP3 mode does not use this format id. It still requests `bestaudio/best` and extracts MP3 with ffmpeg. A payload that already includes a video codec keeps the normal mapper row, including in fixture mode.

| UI                                                                        | Result for this fixture                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Video row `quality-row-mp4` / `quality-row-status-mp4`                    | Rendered in MP4 mode. `data-status` is `ready` before download.                            |
| `quality-download-mp4`                                                    | Download button on that video row. Click this for the MP4 file.                            |
| MP3 fallback `quality-row-mp3-fallback` / `quality-download-mp3-fallback` | Rendered in MP3 mode, because a video quality exists and no audio-only format exists.      |
| `download-button`                                                         | Rendered for both MP4 (`formatId` `mp4`) and MP3 (same fallback as the card).              |
| MP4 summary                                                               | `Best video: unknown @ 0fps (mp4)`                                                         |
| MP3 summary                                                               | `No separate audio streams. Audio will be extracted from the best available video stream.` |

The saved file is the path on `download-saved-path` (`data-saved-path`), inside `MAXFRAME_E2E_OUTPUT_DIR`.

The unit-tests job installs this same binary before `npm run test:unit:coverage` by running `node scripts/ci/ensure-pinned-ytdlp.mjs` and exporting `YT_DLP_PATH`. `tests/infrastructure/e2e/e2e-fixture-ytdlp-real.test.ts` calls `resolveYtdlpExecutable()` and runs `-J --enable-file-urls` against the `file:///` URL of `tests/fixtures/e2e/sample.mp4`. It then analyzes that URL through `createYtdlpVideoMetadataGateway` and expects one video row with `formatId` `mp4`. The test does not skip when the binary is missing. It runs that setup script and fails if the pinned binary does not execute.

## Launch

```bash
mkdir -p /tmp/maxframe-e2e-out
MAXFRAME_E2E=1 \
MAXFRAME_E2E_FIXTURE="$PWD/tests/fixtures/e2e/sample.mp4" \
MAXFRAME_E2E_OUTPUT_DIR=/tmp/maxframe-e2e-out \
npm start
```

Playwright should pass the same variables on `_electron.launch({ env })` for the portable exe. Dev (`npm start`) has no bundled yt-dlp or ffmpeg. The packaged exe resolves the binaries shipped in the build.

Suggested GUI steps for this fixture. The format id is `mp4`. The MP4 choice is a video row. The MP3 choice is the fallback row.

MP4:

1. Fill `link-input` with a YouTube watch URL.
2. Choose MP4 on `format-picker` (`format-option-mp4`).
3. Click `check-quality-button`.
4. Wait for `quality-row-mp4` and `quality-download-mp4`. `download-button` is also present.
5. Click `quality-download-mp4`.
6. Wait for `download-success`. Read `download-saved-path` (`data-saved-path`) and confirm that file is on disk under `MAXFRAME_E2E_OUTPUT_DIR`.

MP3:

1. Fill `link-input` with a YouTube watch URL.
2. Choose MP3 on `format-picker` (`format-option-mp3`).
3. Click `check-quality-button`.
4. Wait for `quality-row-mp3-fallback` and `quality-download-mp3-fallback`. `download-button` is also present.
5. Click `quality-download-mp3-fallback`.
6. Wait for `download-success`. The file at `data-saved-path` is the extracted MP3.

## Test ids

| `data-testid`                     | Where                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `link-input`                      | YouTube links textarea                                                                                                                   |
| `format-picker`                   | MP3/MP4 select on the analyze view                                                                                                       |
| `format-option-mp3`               | MP3 option                                                                                                                               |
| `format-option-mp4`               | MP4 option                                                                                                                               |
| `check-quality-button`            | Starts analyze. The label changes with the link count, so the test id stays put.                                                         |
| `download-button`                 | Download best MP3 or MP4                                                                                                                 |
| `quality-row-<formatId>`          | One quality row                                                                                                                          |
| `quality-row-status-<formatId>`   | Row status. `data-status` is `ready` or `downloading`.                                                                                   |
| `quality-download-<formatId>`     | Download button on that row                                                                                                              |
| `quality-row-mp3-fallback`        | MP3 card when analyze returned a video quality and no audio-only stream. This sample shows it in MP3 mode.                               |
| `quality-row-status-mp3-fallback` | Status for that card (`data-status` as above)                                                                                            |
| `quality-download-mp3-fallback`   | Download button on that card                                                                                                             |
| `download-progress`               | Progress card while a download is running. `data-status` is the stage (`waiting`, `downloading`, `extracting-audio`, `merging`, `done`). |
| `download-success`                | Success banner                                                                                                                           |
| `download-saved-path`             | Path text inside the banner. `data-saved-path` is the saved file path.                                                                   |
| `error-state`                     | Analyze or download error                                                                                                                |
| `output-folder`                   | Last save folder on Settings                                                                                                             |
| `queue-row-status-<jobId>`        | Queue row badge. `data-status` is `complete`, `failed`, `cancelled`, or the phase (`pre`, `download`, `post`, `terminal`).               |

## Local check

```bash
npm run test:unit -- tests/infrastructure/e2e/e2e-test-hook.test.ts tests/infrastructure/e2e/e2e-fixture-ytdlp-real.test.ts tests/infrastructure/youtube/fixture-generic-mp4-row.test.ts tests/unit/e2e-fixture-download.test.ts tests/interface/e2e-fixture-analyze.test.ts packages/renderer/tests/components/e2e-testids.test.tsx tests/infrastructure/youtube/ytdlp-download-and-gateway.test.ts
```
