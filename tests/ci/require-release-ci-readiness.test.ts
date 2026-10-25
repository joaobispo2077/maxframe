import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PUSH_SKIP_READINESS_NAME } from '../../scripts/ci/check-ci-readiness.mjs';
import {
  CI_READINESS_CHECK_NAME,
  PUSH_SKIPPED_CHECK_NAME,
  evaluateReleaseGate,
  optionsFromEnv,
} from '../../scripts/ci/require-release-ci-readiness.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const REPO = 'joaobispo2077/maxframe';
const RED_SHA = 'e4542f7500324a76972f7204f4a98a3f78f48e54';

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

function github({
  pages,
  runs = { '10': workflowRun() },
  tip = SHA,
  failTip = false,
}: {
  pages: { runs: Check[]; total: number }[];
  runs?: Record<string, Run | { status: number }>;
  tip?: string;
  failTip?: boolean;
}) {
  const requested: string[] = [];
  const fetchImpl = async (url: URL | string) => {
    const href = String(url);
    requested.push(href);
    if (href.includes('/check-runs')) {
      const page = Number(new URL(href).searchParams.get('page') || '1');
      const entry = pages[page - 1];
      if (!entry) return jsonResponse({ total_count: 0, check_runs: [] });
      return jsonResponse({
        total_count: entry.total,
        check_runs: entry.runs,
      });
    }
    const runMatch = href.match(/\/actions\/runs\/(\d+)/);
    if (runMatch) {
      const body = runs[runMatch[1]];
      if (!body) return jsonResponse({}, 404);
      if ('status' in body) return jsonResponse({}, body.status);
      return jsonResponse(body);
    }
    if (href.includes('/git/ref/heads/release')) {
      if (failTip) return jsonResponse({}, 500);
      return jsonResponse({ object: { sha: tip, type: 'commit' } });
    }
    return jsonResponse({}, 404);
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

  it.each(['cancelled', 'skipped', 'timed_out', 'neutral', 'stale'])(
    'refuses a pull_request conclusion of %s',
    async (conclusion) => {
      const state = github({
        pages: [{ runs: [check({ conclusion })], total: 1 }],
      });
      await expect(gate(state)).rejects.toThrow(
        new RegExp(`conclusion ${conclusion}`),
      );
    },
  );

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
      reason: `CI readiness from pull_request CI succeeded on ${SHA} and release tip matches`,
    });
    expect(state.requested[0]).toContain('filter=all');
    expect(state.requested[0]).toContain('per_page=100');
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
    const checkouts = release.match(/uses: actions\/checkout@v6/g) || [];
    const refs = release.match(/ref: \$\{\{ github\.sha \}\}/g) || [];
    expect(refs).toHaveLength(checkouts.length);
  });

  it('dry-runs the publish gate against the red v1.9.1 sha', () => {
    expect(proof).toContain(RED_SHA);
    expect(proof).toContain('node scripts/ci/require-release-ci-readiness.mjs');
    expect(proof).toContain('workflow_dispatch');
    expect(proof).not.toContain('npm run release');
    expect(proof).not.toContain('workflow_run');
    expect(proof).toContain(
      'The publish gate would have published the red SHA.',
    );
  });
});
