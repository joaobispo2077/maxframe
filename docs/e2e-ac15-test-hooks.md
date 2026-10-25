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

`MAXFRAME_E2E_FIXTURE` wins over `MAXFRAME_FAKE_VIDEO_METADATA`. The GUI job should not set the fake-metadata flag. Analyze reads the fixture instead of the fake catalog. For this sample, that read has no quality rows. See the format table below.

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

The file needs both a video stream and an audio stream so a later probe can extract MP3 and keep an MP4 video row. The pinned yt-dlp build does not probe those streams for a direct file URL. See the format table below.

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

`mapYtdlpFormatsToQualityOptions` treats a null video codec as no video and drops the format. `mapYtdlpAudioFormatsToQualityOptions` requires an audio codec, so it drops it too. Analyze therefore returns `videoQualities: []` and `audioQualities: []`.

That is neither a video row nor the MP3 fallback:

| UI                                                                        | Result for this fixture                                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Video row `quality-row-<formatId>` / `quality-download-<formatId>`        | Not rendered. There is no format id to target.                                                             |
| MP3 fallback `quality-row-mp3-fallback` / `quality-download-mp3-fallback` | Not rendered. The fallback card is only added when a video quality exists and no audio-only format exists. |
| `download-button`                                                         | Not rendered. Best MP4 and best MP3 both need a quality row.                                               |
| MP4 summary                                                               | `No downloadable video quality available for this URL.`                                                    |
| MP3 summary                                                               | `No downloadable audio quality available for this URL.`                                                    |

The unit-tests job installs this same binary before `npm run test:unit:coverage` by running `node scripts/ci/ensure-pinned-ytdlp.mjs` and exporting `YT_DLP_PATH`. `tests/infrastructure/e2e/e2e-fixture-ytdlp-real.test.ts` calls `resolveYtdlpExecutable()` and runs `-J --enable-file-urls` against the `file:///` URL of `tests/fixtures/e2e/sample.mp4`. The test does not skip when the binary is missing. It runs that setup script and fails if the pinned binary does not execute.

## Launch

```bash
mkdir -p /tmp/maxframe-e2e-out
MAXFRAME_E2E=1 \
MAXFRAME_E2E_FIXTURE="$PWD/tests/fixtures/e2e/sample.mp4" \
MAXFRAME_E2E_OUTPUT_DIR=/tmp/maxframe-e2e-out \
npm start
```

Playwright should pass the same variables on `_electron.launch({ env })` for the portable exe. Dev (`npm start`) has no bundled yt-dlp or ffmpeg. The packaged exe resolves the binaries shipped in the build.

Suggested GUI steps for this fixture:

1. Fill `link-input` with a YouTube watch URL.
2. Choose MP3 or MP4 on `format-picker`.
3. Click `check-quality-button`.
4. Assert the summary text from the table above. Do not wait for `download-button`, `quality-download-<formatId>`, or `quality-download-mp3-fallback`. Those nodes are absent for `tests/fixtures/e2e/sample.mp4` with yt-dlp 2026.08.19.

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
| `quality-row-mp3-fallback`        | MP3 card when analyze returned a video quality and no audio-only stream. This sample does not show it.                                   |
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
npm run test:unit -- tests/infrastructure/e2e/e2e-test-hook.test.ts tests/infrastructure/e2e/e2e-fixture-ytdlp-real.test.ts tests/unit/e2e-fixture-download.test.ts tests/interface/e2e-fixture-analyze.test.ts packages/renderer/tests/components/e2e-testids.test.tsx tests/infrastructure/youtube/ytdlp-download-and-gateway.test.ts
```
