import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PUSH_SKIP_READINESS_NAME } from '../../scripts/ci/check-ci-readiness.mjs';
import {
  CI_READINESS_CHECK_NAME,
  PUSH_SKIPPED_CHECK_NAME,
  evaluateReleaseGate,
  optionsFromEnv,
  skipReleaseTipCheckFromEnv,
} from '../../scripts/ci/require-release-ci-readiness.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const HEAD = 'e'.repeat(40);
const BASE = 'f'.repeat(40);
const REPO = 'joaobispo2077/maxframe';
const RED_SHA = 'e4542f7500324a76972f7204f4a98a3f78f48e54';
const GREEN_SHA = '4f62c8929d088883dae7508434dc14182169e7f7';

type Pull = {
  number: number;
  merged?: boolean;
  base: { ref: string; sha?: string; repo?: { full_name: string } };
  head: { ref?: string; sha: string };
  merge_commit_sha: string | null;
};

type Check = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  details_url: string;
};

type Run = {
  event: string;
  path?: string;
  head_sha?: string;
};

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 1,
    name: CI_READINESS_CHECK_NAME,
    status: 'completed',
    conclusion: 'success',
    details_url:
      'https://github.com/joaobispo2077/maxframe/actions/runs/10/job/20',
    ...overrides,
  };
}

function workflowRun(overrides: Run = {}) {
  return {
    event: 'pull_request',
    path: '.github/workflows/ci.yml',
    head_sha: SHA,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function fastForwardPull(head = SHA): Pull {
  return {
    number: 50,
    merged: true,
    base: { ref: 'release', sha: BASE, repo: { full_name: REPO } },
    head: { ref: 'develop', sha: head },
    merge_commit_sha: null,
  };
}

type Pages = { runs: Check[]; total: number }[];

function checkRunsResponse(href: string, pages: Pages) {
  if (!href.includes('/check-runs')) return null;
  const page = Number(new URL(href).searchParams.get('page') || '1');
  const entry = pages[page - 1];
  if (!entry) return jsonResponse({ total_count: 0, check_runs: [] });
  return jsonResponse({ total_count: entry.total, check_runs: entry.runs });
}

function workflowRunResponse(
  href: string,
  runs: Record<string, Run | { status: number }>,
) {
  const runMatch = href.match(/\/actions\/runs\/(\d+)/);
  if (!runMatch) return null;
  const body = runs[runMatch[1]];
  if (!body) return jsonResponse({}, 404);
  if ('status' in body) return jsonResponse({}, body.status);
  return jsonResponse(body);
}

function releaseTipResponse(href: string, tip: string, failTip: boolean) {
  if (!href.includes('/git/ref/heads/release')) return null;
  if (failTip) return jsonResponse({}, 500);
  return jsonResponse({ object: { sha: tip, type: 'commit' } });
}

function pullResponse(href: string, pulls: Pull[], parents: string[]) {
  if (href.includes('/commits/') && href.includes('/pulls')) {
    return jsonResponse(pulls);
  }
  const pullMatch = href.match(/\/pulls\/(\d+)/);
  if (pullMatch) {
    const pull = pulls.find((item) => String(item.number) === pullMatch[1]);
    return pull ? jsonResponse(pull) : jsonResponse({}, 404);
  }
  if (/\/commits\/[0-9a-f]{40}(?:\?|$)/.test(href)) {
    return jsonResponse({
      sha: SHA,
      parents: parents.map((parent) => ({ sha: parent })),
    });
  }
  return null;
}

function github({
  pages,
  runs = { '10': workflowRun() },
  tip = SHA,
  failTip = false,
  pulls = [fastForwardPull()],
  parents = [BASE, SHA],
}: {
  pages: Pages;
  runs?: Record<string, Run | { status: number }>;
  tip?: string;
  failTip?: boolean;
  pulls?: Pull[];
  parents?: string[];
}) {
  const requested: string[] = [];
  const fetchImpl = async (url: URL | string) => {
    const href = String(url);
    requested.push(href);
    return (
      checkRunsResponse(href, pages) ||
      workflowRunResponse(href, runs) ||
      releaseTipResponse(href, tip, failTip) ||
      pullResponse(href, pulls, parents) ||
      jsonResponse({}, 404)
    );
  };
  return { fetchImpl, requested };
}

function gate(
  githubState: ReturnType<typeof github>,
  overrides: Record<string, unknown> = {},
) {
  return evaluateReleaseGate({
    fetchImpl: githubState.fetchImpl,
    repo: REPO,
    token: 'token',
    sha: SHA,
    ref: 'refs/heads/release',
    timeoutMs: 0,
    intervalMs: 1000,
    perPage: 100,
    ...overrides,
  });
}

describe('require release CI readiness', () => {
  it('keeps the push-skipped name identical to the CI workflow', () => {
    expect(PUSH_SKIPPED_CHECK_NAME).toBe(PUSH_SKIP_READINESS_NAME);
    expect(PUSH_SKIPPED_CHECK_NAME).not.toBe(CI_READINESS_CHECK_NAME);
  });

  it('refuses a missing pull_request CI readiness check', async () => {
    const state = github({
      pages: [{ runs: [check({ name: 'Lint', id: 4 })], total: 1 }],
    });
    await expect(gate(state)).rejects.toThrow(
      /CI readiness check from pull_request CI is missing/,
    );
    expect(state.requested.some((url) => url.includes('/git/ref/'))).toBe(
      false,
    );
  });

  it('refuses a red pull_request check even when push CI succeeded', async () => {
    const state = github({
      pages: [
        {
          total: 2,
          runs: [
            check({
              id: 2,
              conclusion: 'success',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/11/job/1',
            }),
            check({
              id: 8,
              conclusion: 'failure',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/12/job/2',
            }),
          ],
        },
      ],
      runs: {
        '11': workflowRun({ event: 'push' }),
        '12': workflowRun({ event: 'pull_request' }),
      },
    });
    await expect(gate(state)).rejects.toThrow(
      /finished with conclusion failure/,
    );
  });

  it.each([
    'cancelled',
    'skipped',
    'timed_out',
    'neutral',
    'stale',
    'action_required',
  ])('refuses a pull_request conclusion of %s', async (conclusion) => {
    const state = github({
      pages: [{ runs: [check({ conclusion })], total: 1 }],
    });
    await expect(gate(state)).rejects.toThrow(
      new RegExp(`conclusion ${conclusion}`),
    );
  });

  it('refuses the push-skipped variant', async () => {
    const state = github({
      pages: [
        {
          total: 1,
          runs: [
            check({
              name: PUSH_SKIPPED_CHECK_NAME,
              conclusion: 'success',
            }),
          ],
        },
      ],
    });
    await expect(gate(state)).rejects.toThrow(
      /push-skipped check does not count/,
    );
  });

  it('aborts without publishing when release has moved', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      tip: OTHER,
    });
    await expect(gate(state)).rejects.toThrow(/aborting without publishing/);
    expect(
      state.requested.some((url) => url.includes('/git/ref/heads/release')),
    ).toBe(true);
  });

  it('skips the release tip check only when the dry-run flag is set', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      tip: OTHER,
    });
    await expect(gate(state, { skipReleaseTipCheck: true })).resolves.toEqual({
      publish: true,
      sha: SHA,
      headSha: SHA,
      reason: `CI readiness from pull_request CI succeeded on ${SHA} and release tip check skipped`,
    });
    expect(
      state.requested.some((url) => url.includes('/git/ref/heads/release')),
    ).toBe(false);
  });

  it('allows publish when pull_request CI readiness succeeded and the tip matches', async () => {
    const state = github({
      pages: [
        {
          total: 2,
          runs: [
            check({
              id: 3,
              conclusion: 'failure',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/11/job/1',
            }),
            check({ id: 9 }),
          ],
        },
      ],
      runs: {
        '11': workflowRun({ event: 'push' }),
        '10': workflowRun(),
      },
    });
    await expect(gate(state)).resolves.toEqual({
      publish: true,
      sha: SHA,
      headSha: SHA,
      reason: `CI readiness from pull_request CI succeeded on ${SHA} and release tip matches`,
    });
    const checksUrl = state.requested.find((url) =>
      url.includes('/check-runs'),
    );
    expect(checksUrl).toContain('filter=all');
    expect(checksUrl).toContain('per_page=100');
  });

  it('allows a merge commit when the pull request head is green', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      runs: { '10': workflowRun({ head_sha: HEAD }) },
      pulls: [
        {
          number: 134,
          merged: true,
          base: { ref: 'release', sha: BASE, repo: { full_name: REPO } },
          head: { sha: HEAD, ref: 'develop' },
          merge_commit_sha: SHA,
        },
      ],
      parents: [BASE, HEAD],
      tip: SHA,
    });
    await expect(gate(state)).resolves.toMatchObject({
      publish: true,
      sha: SHA,
      headSha: HEAD,
    });
    expect(
      state.requested.some((url) =>
        url.includes(`/commits/${HEAD}/check-runs`),
      ),
    ).toBe(true);
  });

  it('blocks a merge commit when the pull request head is red', async () => {
    const state = github({
      pages: [
        {
          total: 2,
          runs: [
            check({
              id: 2,
              conclusion: 'success',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/11/job/1',
            }),
            check({
              id: 4,
              conclusion: 'failure',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/12/job/2',
            }),
          ],
        },
      ],
      runs: {
        '11': workflowRun({ event: 'push', head_sha: HEAD }),
        '12': workflowRun({ event: 'pull_request', head_sha: HEAD }),
      },
      pulls: [
        {
          number: 132,
          merged: true,
          base: { ref: 'release', sha: BASE },
          head: { sha: HEAD },
          merge_commit_sha: SHA,
        },
      ],
      parents: [BASE, HEAD],
    });
    await expect(gate(state)).rejects.toThrow(
      /finished with conclusion failure/,
    );
  });

  it('blocks a merge commit when the second parent is not the pull request head', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      pulls: [
        {
          number: 132,
          merged: true,
          base: { ref: 'release', sha: BASE },
          head: { sha: HEAD },
          merge_commit_sha: SHA,
        },
      ],
      parents: [BASE, OTHER],
    });
    await expect(gate(state)).rejects.toThrow(/parent mismatch/);
    expect(state.requested.some((url) => url.includes('/check-runs'))).toBe(
      false,
    );
  });

  it('blocks a commit with no associated pull request', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      pulls: [],
    });
    await expect(gate(state)).rejects.toThrow(/no associated pull request/);
    expect(state.requested.some((url) => url.includes('/check-runs'))).toBe(
      false,
    );
  });

  it('lets a later successful re-run replace an earlier failure', async () => {
    const state = github({
      pages: [
        {
          total: 2,
          runs: [
            check({
              id: 1,
              conclusion: 'failure',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/10/job/1',
            }),
            check({
              id: 2,
              conclusion: 'success',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/10/job/2',
            }),
          ],
        },
      ],
    });
    await expect(gate(state)).resolves.toMatchObject({ publish: true });
  });

  it('lets a later failed re-run replace an earlier success', async () => {
    const state = github({
      pages: [
        {
          total: 2,
          runs: [
            check({
              id: 1,
              conclusion: 'success',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/10/job/1',
            }),
            check({
              id: 9,
              conclusion: 'failure',
              details_url:
                'https://github.com/joaobispo2077/maxframe/actions/runs/10/job/9',
            }),
          ],
        },
      ],
    });
    await expect(gate(state)).rejects.toThrow(
      /finished with conclusion failure/,
    );
  });

  it('polls a missing check until the deadline', async () => {
    let nowMs = 0;
    let sleeps = 0;
    const state = github({
      pages: [{ runs: [check({ name: 'Lint', id: 4 })], total: 1 }],
    });
    await expect(
      gate(state, {
        timeoutMs: 1000,
        now: () => nowMs,
        sleep: async (ms: number) => {
          sleeps += 1;
          nowMs += ms;
        },
      }),
    ).rejects.toThrow(/missing/);
    expect(sleeps).toBe(1);
  });

  it('finds a passing check after the first 30 check runs', async () => {
    const filler = Array.from({ length: 30 }, (_, index) =>
      check({
        id: index + 1,
        name: 'Lint',
        details_url: `https://github.com/joaobispo2077/maxframe/actions/runs/11/job/${index}`,
      }),
    );
    const state = github({
      pages: [
        { runs: filler, total: 31 },
        { runs: [check({ id: 40 })], total: 31 },
      ],
      runs: { '10': workflowRun() },
    });
    const result = await gate(state, { perPage: 30 });
    expect(result.publish).toBe(true);
    expect(
      state.requested.filter((url) => url.includes('page=2')),
    ).toHaveLength(1);
  });

  it('fails closed when a pending check does not finish in time', async () => {
    let nowMs = 0;
    const state = github({
      pages: [
        {
          runs: [check({ status: 'in_progress', conclusion: null })],
          total: 1,
        },
      ],
    });
    await expect(
      gate(state, {
        timeoutMs: 1000,
        now: () => nowMs,
        sleep: async (ms: number) => {
          nowMs += ms;
        },
      }),
    ).rejects.toThrow(/timed out waiting/);
  });

  it('waits out a pending check and then allows publish', async () => {
    let polls = 0;
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
    });
    const fetchImpl = async (url: URL | string) => {
      if (String(url).includes('/check-runs') && polls === 0) {
        polls += 1;
        return jsonResponse({
          total_count: 1,
          check_runs: [check({ status: 'queued', conclusion: null })],
        });
      }
      return state.fetchImpl(url);
    };
    let nowMs = 0;
    await expect(
      evaluateReleaseGate({
        fetchImpl,
        repo: REPO,
        token: 'token',
        sha: SHA,
        ref: 'refs/heads/release',
        timeoutMs: 5000,
        intervalMs: 1000,
        now: () => nowMs,
        sleep: async (ms: number) => {
          nowMs += ms;
        },
      }),
    ).resolves.toMatchObject({ publish: true });
    expect(polls).toBe(1);
  });

  it('fails closed on a check-runs API error', async () => {
    const fetchImpl = async () => jsonResponse({}, 503);
    await expect(
      evaluateReleaseGate({
        fetchImpl,
        repo: REPO,
        token: 'token',
        sha: SHA,
        ref: 'refs/heads/release',
        timeoutMs: 0,
        intervalMs: 1000,
      }),
    ).rejects.toThrow(/GitHub API request failed: 503/);
  });

  it('fails closed when the tip lookup errors after a green check', async () => {
    const state = github({
      pages: [{ runs: [check()], total: 1 }],
      failTip: true,
    });
    await expect(gate(state)).rejects.toThrow(/GitHub API request failed: 500/);
  });

  it('does not let workflow_dispatch on another branch bypass the gate', async () => {
    const fetchImpl = async () => {
      throw new Error('fetch should not run');
    };
    await expect(
      evaluateReleaseGate({
        fetchImpl,
        repo: REPO,
        token: 'token',
        sha: SHA,
        ref: 'refs/heads/develop',
        timeoutMs: 0,
        intervalMs: 1000,
      }),
    ).rejects.toThrow(/refs\/heads\/release/);
  });

  it('reads the commit from TARGET_SHA and rejects a bad wait', () => {
    expect(
      optionsFromEnv({
        GITHUB_REPOSITORY: REPO,
        GH_TOKEN: 'token',
        TARGET_SHA: SHA,
        GITHUB_SHA: OTHER,
        TARGET_REF: 'refs/heads/release',
      }),
    ).toMatchObject({ sha: SHA, ref: 'refs/heads/release' });
    expect(() => optionsFromEnv({ CI_READINESS_TIMEOUT_MS: 'later' })).toThrow(
      /non-negative/,
    );
    expect(optionsFromEnv({ TARGET_SHA: SHA }).skipReleaseTipCheck).toBe(false);
  });

  it('accepts only an explicit dry-run tip skip', () => {
    expect(skipReleaseTipCheckFromEnv(undefined)).toBe(false);
    expect(skipReleaseTipCheckFromEnv('')).toBe(false);
    expect(skipReleaseTipCheckFromEnv('0')).toBe(false);
    expect(skipReleaseTipCheckFromEnv('false')).toBe(false);
    expect(skipReleaseTipCheckFromEnv('1')).toBe(true);
    expect(skipReleaseTipCheckFromEnv('true')).toBe(true);
    expect(() => skipReleaseTipCheckFromEnv('yes')).toThrow(
      /CI_READINESS_SKIP_RELEASE_TIP_CHECK/,
    );
  });
});

describe('release workflow contract', () => {
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  const proof = readFileSync(
    '.github/workflows/release-gate-dry-run.yml',
    'utf8',
  );

  it('keeps the push trigger and gates publish on the exact sha', () => {
    expect(release).not.toContain('workflow_run');
    expect(release).toContain('workflow_dispatch');
    const on = release.slice(0, release.indexOf('\njobs:'));
    expect(on).toContain('push:');
    expect(on).toMatch(/- release\n/);
    expect(release).toContain('checks: read');
    expect(release).toContain('actions: read');
    expect(release).toContain('pull-requests: read');
    const publish = release.slice(release.indexOf('  release:\n'));
    expect(publish).toContain('ref: ${{ github.sha }}');
    expect(publish).toContain('fetch-depth: 0');
    const scriptAt = publish.indexOf(
      'node scripts/ci/require-release-ci-readiness.mjs',
    );
    const releaseAt = publish.indexOf('npm run release');
    expect(scriptAt).toBeGreaterThan(0);
    expect(releaseAt).toBeGreaterThan(scriptAt);
    expect(publish.slice(0, scriptAt)).toContain(
      'TARGET_SHA: ${{ github.sha }}',
    );
    expect(release).not.toMatch(/CI_READINESS_SKIP_RELEASE_TIP_CHECK\s*:/);
    const checkouts = release.match(/uses: actions\/checkout@v6/g) || [];
    const refs = release.match(/ref: \$\{\{ github\.sha \}\}/g) || [];
    expect(refs).toHaveLength(checkouts.length);
  });

  it('dry-runs the publish gate against the red and green promotions', () => {
    expect(proof).toContain('pull_request:');
    expect(proof).toContain(RED_SHA);
    expect(proof).toContain(GREEN_SHA);
    expect(proof).toContain('node scripts/ci/require-release-ci-readiness.mjs');
    expect(proof).toContain('workflow_dispatch');
    expect(proof).not.toContain('npm run release');
    expect(proof).not.toContain('workflow_run');
    expect(proof).toContain(
      'The publish gate would have published the red SHA.',
    );
    const greenAt = proof.indexOf('green promotion');
    const redAt = proof.indexOf('red promotion');
    expect(greenAt).toBeGreaterThan(0);
    expect(redAt).toBeGreaterThan(greenAt);
    expect(proof.slice(greenAt, redAt)).toContain(
      "CI_READINESS_SKIP_RELEASE_TIP_CHECK: '1'",
    );
    expect(proof.slice(redAt)).not.toContain(
      'CI_READINESS_SKIP_RELEASE_TIP_CHECK',
    );
  });
});
