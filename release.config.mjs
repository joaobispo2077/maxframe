import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { prepare as assertReleaseTipBeforeTag } from './scripts/ci/assert-release-tip-before-tag.mjs';

const releaseAssetsDir = join(process.cwd(), 'release-assets');
// Matches both the NSIS installer (*-win-x64.exe) and the portable (*-portable-win-x64.exe).
const hasWindowsInstallerInWorkspace =
  existsSync(releaseAssetsDir) &&
  readdirSync(releaseAssetsDir).some((f) => /-win-x64\.exe$/i.test(f));

/**
 * When docs/patch-notes/<version>.md exists, append it to the generated notes.
 * semantic-release joins generateNotes results, so the conventional notes stay
 * and the hotfix patch notes ship in the GitHub release and CHANGELOG.
 */
const appendVersionPatchNotes = {
  async generateNotes(_pluginConfig, context) {
    const version = context.nextRelease?.version;
    if (!version) {
      return undefined;
    }
    const patchNotesPath = join(
      process.cwd(),
      'docs',
      'patch-notes',
      `${version}.md`,
    );
    if (!existsSync(patchNotesPath)) {
      return undefined;
    }
    const patchNotes = readFileSync(patchNotesPath, 'utf8').trim();
    return patchNotes || undefined;
  },
};

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
    appendVersionPatchNotes,
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
                path: [
                  'release-assets/*-win-x64.exe',
                  '!release-assets/*-portable-win-x64.exe',
                ],
                label: 'Windows Installer (x64)',
              },
              {
                path: 'release-assets/*-portable-win-x64.exe',
                label: 'Windows Portable (x64)',
              },
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
    { prepare: assertReleaseTipBeforeTag },
  ],
};
