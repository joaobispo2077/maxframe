import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const releaseAssetsDir = join(process.cwd(), 'release-assets');
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
            /** GHA release job downloads the Windows .exe to `release-assets/` before `npm run release`. */
            assets: [{ path: 'release-assets/*-win-x64.exe' }],
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
