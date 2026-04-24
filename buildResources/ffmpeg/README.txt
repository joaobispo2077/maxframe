Bundled ffmpeg (optional)
=========================

Before running `npm run compile`, place a static **ffmpeg** build for your
target OS in this folder so electron-builder can copy it into the app
(`resources/ffmpeg/` at runtime — see `resolveFfmpegExecutable`):

  Windows:  ffmpeg.exe
  Linux:    ffmpeg   (executable bit set)
  macOS:    ffmpeg   (executable bit set)

Official builds: https://ffmpeg.org/download.html

Do not commit the binary to git (see repository .gitignore).

If this folder only contains README.txt, merge downloads still work when
ffmpeg is on the user's PATH or when FFMPEG_PATH is set.
