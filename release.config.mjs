import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const releaseAssetsDir = join(process.cwd(), 'release-assets');
// Matches both the NSIS installer (*-win-x64.exe) and the portable (*-portable-win-x64.exe).
const hasWindowsInstallerInWorkspace =
  existsSync(releaseAssetsDir) &&
  readdirSync(releaseAssetsDir).some(f => /-win-x64\.exe$/i.test(f));

/** @type {import('semantic-release').Options} */
export default {
  branches: ['release'],
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
        },
        writerOpts: {
          commitsSort: ['subject', 'scope'],
        },
      },
    ],
    '@semantic-release/changelog',
    hasWindowsInstallerInWorkspace
      ? [
          '@semantic-release/github',
          {
            /**
             * GHA release job downloads both Windows artifacts to `release-assets/` before `npm run release`.
             * Two labeled entries so the GitHub Release page shows distinct named downloads.
             * The installer glob excludes the portable artifact via the more specific portable glob below.
             */
            assets: [
              {
                // Negation excludes the portable artifact so only the NSIS installer is labelled here.
                path: ['release-assets/*-win-x64.exe', '!release-assets/*-portable-win-x64.exe'],
                label: 'Windows Installer (x64)',
              },
              { path: 'release-assets/*-portable-win-x64.exe', label: 'Windows Portable (x64)' },
            ],
          },
        ]
      : '@semantic-release/github',
    ['@semantic-release/npm', { npmPublish: false }],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
        message:
          'chore(release): ${nextRelease.version} \n\n${nextRelease.notes}',
      },
    ],
  ],
};
