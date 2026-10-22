Bundled yt-dlp (optional)
=========================

Before running `npm run compile`, place the official yt-dlp binary for your
target OS in this folder so electron-builder can copy it into the app:

  Windows:  yt-dlp.exe
  Linux:    yt-dlp   (executable bit set)
  macOS:    yt-dlp   (executable bit set)

Download: https://github.com/yt-dlp/yt-dlp/releases

Windows CI pins yt-dlp 2026.08.19 in scripts/download-bundled-yt-dlp.mjs.
That script downloads yt-dlp.exe from the official GitHub release
(https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe)
and fails the build if the SHA-256 does not match that release's SHA2-256SUMS.

Do not commit the binary to git (see repository .gitignore).

If this folder only contains README.txt, packaged builds still work when
yt-dlp is installed on the user's PATH or when YT_DLP_PATH is set.

For merge downloads, see also ../ffmpeg/README.txt (optional bundled ffmpeg).
