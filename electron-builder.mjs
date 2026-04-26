import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import mapWorkspaces from '@npmcli/map-workspaces';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8'),
);

const isGitHubOrCi = process.env.CI === 'true';
/** On CI (e.g. GHA) we do full PE edits. Locally default off — enables builds without Windows symlink / Developer Mode. Opt-in: `MAXFRAME_WIN_FULL_PE=1`. */
const useFullWinExecutableEdit = isGitHubOrCi || process.env.MAXFRAME_WIN_FULL_PE === '1';

export default /** @type import('electron-builder').Configuration */
({
  appId: 'com.maxframe.app',
  productName: 'Maxframe',
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  generateUpdatesFilesForAllChannels: true,
  /**
   * Windows targets (x64):
   *   NSIS installer  — `npm run compile:win`          → `Maxframe-${version}-win-x64.exe`
   *   Portable exe    — `npm run compile:win:portable`  → `Maxframe-${version}-portable-win-x64.exe`
   *
   * `win.target` only lists `nsis`; the portable target is selected at build time via `--target portable`.
   * Both share the same `extraResources` (yt-dlp, ffmpeg) so the portable build is fully self-contained.
   *
   * NSIS silent install: `Maxframe-x.y.z-win-x64.exe /S /D=C:\path\to\prefix`  (/D= must be last)
   */
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    /**
     * `false` skips rcedit + asar-integrity (winCodeSign) when not on CI. GHA sets `CI=true` so release builds use the full path.
     * Local: set `MAXFRAME_WIN_FULL_PE=1` (and usually Windows Developer Mode) to match CI. See docs/releasing-windows.md.
     */
    signAndEditExecutable: useFullWinExecutableEdit,
  },
  // Product decision: ship English locale only to reduce packaged footprint.
  electronLanguages: ['en-US'],
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    include: 'buildResources/nsis/uninstall-cleanup.nsh',
  },
  /**
   * Portable build artifact name — the `-portable-` infix distinguishes it from the NSIS installer
   * so both files can coexist in `release-assets/` without collision.
   * Runtime: electron-builder sets `PORTABLE_EXECUTABLE_DIR` before app code runs; the main process
   * uses this to redirect `userData` to `<exe-dir>\MaxframeData\`.
   */
  portableOptions: {
    artifactName: '${productName}-${version}-portable-${os}-${arch}.${ext}',
  },
  linux: {
    target: ['deb'],
  },
  /**
   * It is recommended to avoid using non-standard characters such as spaces in artifact names,
   * as they can unpredictably change during deployment, making them impossible to locate and download for update.
   */
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  /**
   * Optional binaries for packaged installs:
   * - yt-dlp: `buildResources/yt-dlp/README.txt`; runtime `resolveYtdlpExecutable` checks `resources/yt-dlp/`.
   * - ffmpeg: `buildResources/ffmpeg/README.txt`; runtime `resolveFfmpegExecutable` checks `resources/ffmpeg/`.
   */
  extraResources: [
    {
      from: 'buildResources/yt-dlp',
      to: 'yt-dlp',
      filter: ['**/*'],
    },
    {
      from: 'buildResources/ffmpeg',
      to: 'ffmpeg',
      filter: ['**/*'],
    },
  ],
  files: [
    pkg.main,
    '!node_modules/@maxframe/**',
    // Conservative size hygiene: exclude non-runtime metadata/artifacts from production package.
    '!**/*.map',
    '!**/node_modules/**/*.d.ts',
    '!**/node_modules/**/{README.md,README,readme.md,readme,CHANGELOG.md,CHANGELOG}',
    '!**/node_modules/**/{test,tests,__tests__,example,examples}/**',
    ...await getListOfFilesFromEachWorkspace(),
  ],
});

/**
 * By default, electron-builder copies each package into the output compilation entirety,
 * including the source code, tests, configuration, assets, and any other files.
 *
 * So you may get compiled app structure like this:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── src/            # Garbage. May be safely removed
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   ├── vite.config.js  # Garbage
 * │       │   ├── .env            # some sensitive config
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 *
 * To prevent this, we read the “files”
 * property from each package's package.json
 * and add all files that do not match the patterns to the exclusion list.
 *
 * This way,
 * each package independently determines which files will be included in the final compilation and which will not.
 *
 * So if `package-a` in its `package.json` describes
 * ```json
 * {
 *   "name": "package-a",
 *   "files": [
 *     "dist/**\/"
 *   ]
 * }
 * ```
 *
 * Then in the compilation only those files and `package.json` will be included:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 */
async function getListOfFilesFromEachWorkspace() {

  /**
   * @type {Map<string, string>}
   */
  const workspaces = await mapWorkspaces({
    cwd: process.cwd(),
    pkg,
  });

  const allFilesToInclude = [];

  for (const [name, path] of workspaces) {
    const pkgPath = join(path, 'package.json');
    const workspacePkg = JSON.parse(await readFile(pkgPath, 'utf8'));

    let patterns = workspacePkg.files || ['dist/**', 'package.json'];

    patterns = patterns.map(p => join('node_modules', name, p));
    allFilesToInclude.push(...patterns);
  }

  return allFilesToInclude;
}
