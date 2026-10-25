# AC15 app hooks (local fixture and test ids)

Playwright `_electron` will launch the packaged portable exe, paste a link, pick MP3, download, then download a video row. This page is the app side of that check. The workflow, the Playwright job, and `release.yml` are out of scope here.

The hook is inert unless test mode is on. There is no control in the UI that turns it on.

## Why two environment variables

The GUI test launches the real portable exe, so the hook has to be read at runtime. It cannot be compiled out of the build the test starts. A single fixture variable would also change a normal launch if that variable leaked into the environment. Test mode is a second, exact opt-in.

| Variable                  | Required value                                          | Effect when `MAXFRAME_E2E=1`                                              |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `MAXFRAME_E2E`            | exactly `1`                                             | Turns the hook on. `true`, `yes`, or `1` with spaces leave it off.        |
| `MAXFRAME_E2E_FIXTURE`    | absolute path, or `file:` URL, of an existing file      | Analyze and download pass this path to yt-dlp instead of the YouTube URL. |
| `MAXFRAME_E2E_OUTPUT_DIR` | absolute path, or `file:` URL, of an existing directory | Analyze-tab downloads write here and skip the native save dialog.         |

Any other combination keeps the normal YouTube path and the save dialog. In particular, `MAXFRAME_E2E_FIXTURE` alone does nothing.

When test mode is on and a path variable is set, the path must be local and must exist. Remote URLs and relative paths are rejected. A missing file, a directory used as the fixture, or a file used as the output directory fails the analyze or download with `E2eTestHookError` instead of falling through to YouTube.

The pasted link is still validated as a YouTube URL. The test can paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ`. After that check, yt-dlp receives the fixture path. Format selection, `--extract-audio` / MP4 merge arguments, and `--ffmpeg-location` stay the same as a normal download, so MP3 and MP4 are still produced by the bundled tools.

`MAXFRAME_E2E_FIXTURE` wins over `MAXFRAME_FAKE_VIDEO_METADATA`. The GUI job should not set the fake-metadata flag. Analyze has to read formats from the fixture or the video row's format id will not match the file.

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

The file needs both a video stream and an audio stream so MP3 extraction and an MP4 video row both succeed.

## Launch

```bash
mkdir -p /tmp/maxframe-e2e-out
MAXFRAME_E2E=1 \
MAXFRAME_E2E_FIXTURE="$PWD/tests/fixtures/e2e/sample.mp4" \
MAXFRAME_E2E_OUTPUT_DIR=/tmp/maxframe-e2e-out \
npm start
```

Playwright should pass the same variables on `_electron.launch({ env })` for the portable exe. Dev (`npm start`) has no bundled yt-dlp or ffmpeg. The packaged exe resolves the binaries shipped in the build.

Suggested GUI steps:

1. Fill `link-input` with a YouTube watch URL.
2. Choose MP3 on `format-picker` (`format-option-mp3`).
3. Click `check-quality-button` and wait until `download-button` is visible.
4. Click `download-button`.
5. Assert `download-success` and read `download-saved-path`'s `data-saved-path`. The file at that path should exist and be non-empty.
6. Choose MP4, click the video row `quality-download-<formatId>`, and assert success again.

Format ids come from the fixture, not from YouTube. Prefer the row test id that is on screen over a hard-coded YouTube id such as `137`. A muxed fixture has no separate audio stream, so MP3 mode shows `quality-download-mp3-fallback` in addition to `download-button`.

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
| `quality-row-mp3-fallback`        | MP3 card when the fixture has no separate audio stream                                                                                   |
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
npm run test:unit -- tests/infrastructure/e2e/e2e-test-hook.test.ts tests/unit/e2e-fixture-download.test.ts tests/interface/e2e-fixture-analyze.test.ts packages/renderer/tests/components/e2e-testids.test.tsx
```
