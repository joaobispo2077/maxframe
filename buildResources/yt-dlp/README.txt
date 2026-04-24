Bundled yt-dlp (optional)
=========================

Before running `npm run compile`, place the official yt-dlp binary for your
target OS in this folder so electron-builder can copy it into the app:

  Windows:  yt-dlp.exe
  Linux:    yt-dlp   (executable bit set)
  macOS:    yt-dlp   (executable bit set)

Download: https://github.com/yt-dlp/yt-dlp/releases

Do not commit the binary to git (see repository .gitignore).

If this folder only contains README.txt, packaged builds still work when
yt-dlp is installed on the user's PATH or when YT_DLP_PATH is set.
