import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isCurrentPr,
  main,
  selectRun,
} from '../../scripts/ci/select-ci-run.mjs';

const REPOSITORY = 'owner/maxframe';
const BRANCH = 'feature/example';
const SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);

type Pull = {
  number: number | null;
  state: string;
  draft?: boolean;
  mergeable?: unknown;
  head: {
    ref: string;
    sha: string;
    repo: { full_name: string };
  };
  base: {
    ref: string;
    sha: string;
    repo: { full_name: string };
  };
};

function pullRequest({
  base = 'develop',
  draft = false,
}: { base?: string; draft?: boolean } = {}): Pull {
  return {
    number: 96,
    state: 'open',
    draft,
    head: {
      ref: BRANCH,
      sha: SHA,
      repo: { full_name: REPOSITORY },
    },
    base: {
      ref: base,
      sha: BASE_SHA,
      repo: { full_name: REPOSITORY },
    },
  };
}

function selected(
  pulls: unknown,
  {
    workflow = 'ci',
    event = 'push',
    branch = BRANCH,
  }: { workflow?: string; event?: string; branch?: string } = {},
) {
  const decision = selectRun(workflow, event, REPOSITORY, branch, SHA, pulls);
  expect(decision.reason.length).toBeGreaterThan(0);
  return decision.run;
}

describe('selectRun', () => {
  it.each(['ci', 'engine-binary'])(
    'runs full validation before a PR exists (%s)',
    (workflow) => {
      expect(selected([], { workflow })).toBe(true);
    },
  );

  it.each([false, true])(
    'defers to an open PR on develop, release, and main (draft=%s)',
    (draft) => {
      for (const base of ['develop', 'release', 'main']) {
        expect(selected([pullRequest({ base, draft })])).toBe(false);
      }
    },
  );

  it.each([
    ['state', 'closed'],
    ['number', null],
    ['head.ref', 'feature/another'],
    ['head.sha', 'c'.repeat(40)],
    ['head.repo', { full_name: 'fork/maxframe' }],
    ['base.repo', { full_name: 'other/maxframe' }],
  ] as const)(
    'does not suppress on a foreign or stale PR (%s)',
    (path, value) => {
      const pull = pullRequest() as unknown as Record<string, unknown>;
      const [section, field] = path.includes('.')
        ? path.split('.')
        : [null, path];
      const target = (section ? pull[section] : pull) as Record<
        string,
        unknown
      >;
      target[field] = value;
      expect(selected([pull])).toBe(true);
    },
  );

  it('lets ci defer only to supported bases and engine-binary accept any base', () => {
    const pull = pullRequest({ base: 'experiment' });
    expect(selected([pull], { workflow: 'ci' })).toBe(true);
    expect(selected([pull], { workflow: 'engine-binary' })).toBe(false);
  });

  it.each(['pull_request', 'workflow_dispatch', 'release'])(
    'always validates non-push events (%s)',
    (event) => {
      expect(selected([pullRequest()], { event })).toBe(true);
    },
  );

  it.each(['release', 'main', 'develop', 'featureish'])(
    'keeps a non-feature push on full validation (%s)',
    (branch) => {
      expect(selected([pullRequest()], { branch })).toBe(true);
    },
  );

  it('finds a matching PR after unrelated requests', () => {
    const unrelated = pullRequest();
    unrelated.head.sha = 'c'.repeat(40);
    expect(selected([unrelated, pullRequest()])).toBe(false);
  });

  it.each([null, {}, [null], ['not a PR'], [[{}]]])(
    'treats an incomplete lookup as full validation',
    (pulls) => {
      expect(selected(pulls)).toBe(true);
    },
  );
});

describe('isCurrentPr', () => {
  it('allows a fresh PR, including a fork whose event identity still matches', () => {
    const current = pullRequest();
    current.head.repo.full_name = 'fork/maxframe';
    const event = { number: 96, pull_request: structuredClone(current) };
    expect(isCurrentPr(event, current, REPOSITORY)).toBe(true);
    current.head.repo.full_name = REPOSITORY;
    expect(isCurrentPr(event, current, REPOSITORY)).toBe(false);
  });

  it.each([
    ['state', 'closed'],
    ['number', 97],
    ['head.sha', 'c'.repeat(40)],
    ['base.sha', 'c'.repeat(40)],
    ['head.ref', 'feature/replaced'],
    ['base.ref', 'main'],
    ['head.repo', { full_name: 'fork/maxframe' }],
    ['base.repo', { full_name: 'other/maxframe' }],
  ] as const)('rejects a stale or retargeted PR (%s)', (path, value) => {
    const current = pullRequest() as unknown as Record<string, unknown>;
    const event = {
      number: 96,
      pull_request: structuredClone(current),
    };
    const [section, field] = path.includes('.')
      ? path.split('.')
      : [null, path];
    const target = (section ? current[section] : current) as Record<
      string,
      unknown
    >;
    target[field] = value;
    expect(isCurrentPr(event, current, REPOSITORY)).toBe(false);
  });

  it.each([null, [], {}, { state: 'open' }])(
    'denies publication when current PR evidence is incomplete',
    (current) => {
      const event = { number: 96, pull_request: pullRequest() };
      expect(isCurrentPr(event, current, REPOSITORY)).toBe(false);
    },
  );

  it('requires the base repository to be this repository', () => {
    const current = pullRequest();
    const event = { number: 96, pull_request: structuredClone(current) };
    expect(isCurrentPr(event, current, 'other/maxframe')).toBe(false);
  });
});

type FetchCall = { url: string; method: string; timedOut: boolean };

function mockFetch(
  responses: Array<{ body?: unknown; ok?: boolean; status?: number } | Error>,
) {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const fetchImpl = async (
    url: URL,
    options: { method?: string; signal?: AbortSignal },
  ) => {
    calls.push({
      url: String(url),
      method: options.method || '',
      timedOut: Boolean(options.signal),
    });
    const next = queue.shift();
    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;
    return {
      ok: next.ok !== false,
      status: next.status ?? 200,
      json: async () => next.body,
    };
  };
  return { fetchImpl, calls };
}

function readOutputs(path: string) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq), line.slice(eq + 1)];
      }),
  );
}

function environment() {
  const dir = mkdtempSync(join(tmpdir(), 'select-ci-'));
  const output = join(dir, 'output');
  const summary = join(dir, 'summary.md');
  const eventPath = join(dir, 'event.json');
  writeFileSync(output, '');
  writeFileSync(summary, '');
  writeFileSync(
    eventPath,
    JSON.stringify({ number: 96, pull_request: pullRequest() }),
  );
  const env = {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_REF_NAME: BRANCH,
    GITHUB_SHA: SHA,
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_EVENT_PATH: eventPath,
    GH_TOKEN: 'test-token',
  };
  return { output, summary, env };
}

describe('select-ci-run cli', () => {
  it('selects full validation before PR creation', async () => {
    const { output, summary, env } = environment();
    const { fetchImpl, calls } = mockFetch([{ body: [] }]);
    expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
    const result = readOutputs(output);
    expect(result.run_full_ci).toBe('true');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(readFileSync(summary, 'utf8')).toContain(result.reason);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('per_page=100');
    expect(calls[0].url).toContain('state=open');
    expect(calls[0].url).toContain(
      `head=${encodeURIComponent(`owner:${BRANCH}`)}`,
    );
    expect(calls[0].method).toBe('GET');
    expect(calls[0].timedOut).toBe(true);
  });

  it('rechecks the PR and skips only when it is mergeable', async () => {
    const { output, summary, env } = environment();
    const { fetchImpl, calls } = mockFetch([
      { body: [pullRequest()] },
      { body: { ...pullRequest(), mergeable: true } },
    ]);
    expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
    expect(readOutputs(output).run_full_ci).toBe('false');
    expect(readFileSync(summary, 'utf8').toLowerCase()).toContain('skipped');
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain(`/repos/${REPOSITORY}/pulls/96`);
    expect(calls[1].method).toBe('GET');
  });

  it.each([false, null, 'true', 1, 'missing'])(
    'keeps push validation when mergeability is not boolean true (%s)',
    async (mergeable) => {
      const { output, env } = environment();
      const current: Record<string, unknown> = { ...pullRequest() };
      if (mergeable !== 'missing') current.mergeable = mergeable;
      const { fetchImpl, calls } = mockFetch([
        { body: [pullRequest()] },
        { body: current },
      ]);
      expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
      expect(readOutputs(output).run_full_ci).toBe('true');
      expect(calls).toHaveLength(2);
    },
  );

  it.each(['head', 'closed', 'retargeted'])(
    'does not skip when the PR changes between list and detail (%s)',
    async (change) => {
      const { output, env } = environment();
      const current = { ...pullRequest(), mergeable: true };
      if (change === 'head')
        current.head = { ...current.head, sha: 'c'.repeat(40) };
      if (change === 'closed') current.state = 'closed';
      if (change === 'retargeted') {
        current.base = { ...current.base, ref: 'unsupported-target' };
      }
      const { fetchImpl, calls } = mockFetch([
        { body: [pullRequest()] },
        { body: current },
      ]);
      expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
      expect(readOutputs(output).run_full_ci).toBe('true');
      expect(calls).toHaveLength(2);
    },
  );

  it.each([null, [], 'not a PR'])(
    'keeps push validation when the PR detail is malformed',
    async (current) => {
      const { output, env } = environment();
      const { fetchImpl } = mockFetch([
        { body: [pullRequest()] },
        { body: current },
      ]);
      expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
      expect(readOutputs(output).run_full_ci).toBe('true');
    },
  );

  it('keeps push validation when the detail lookup fails', async () => {
    const { output, env } = environment();
    const { fetchImpl, calls } = mockFetch([
      { body: [pullRequest()] },
      new Error('denied'),
    ]);
    expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
    expect(readOutputs(output).run_full_ci).toBe('true');
    expect(calls).toHaveLength(2);
  });

  it.each([null, {}, [null], ['not a PR'], [[{}]]])(
    'falls back to full validation on a malformed list (%j)',
    async (payload) => {
      const { output, env } = environment();
      const { fetchImpl } = mockFetch([{ body: payload }]);
      expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
      expect(readOutputs(output).run_full_ci).toBe('true');
    },
  );

  it.each(['denied', 'http'])(
    'never removes validation when the lookup fails (%s)',
    async (failure) => {
      const { output, env } = environment();
      const { fetchImpl } = mockFetch([
        failure === 'denied'
          ? new Error('private detail')
          : { ok: false, status: 500, body: { message: 'nope' } },
      ]);
      expect(await main(env, ['--workflow', 'ci'], { fetchImpl })).toBe(0);
      expect(readOutputs(output).run_full_ci).toBe('true');
    },
  );

  it.each([
    ['push', 'release'],
    ['pull_request', BRANCH],
    ['workflow_dispatch', BRANCH],
  ] as const)('does not look up PRs for %s on %s', async (event, branch) => {
    const { output, env } = environment();
    const { fetchImpl, calls } = mockFetch([]);
    expect(
      await main(
        { ...env, GITHUB_EVENT_NAME: event, GITHUB_REF_NAME: branch },
        ['--workflow', 'ci'],
        { fetchImpl },
      ),
    ).toBe(0);
    expect(readOutputs(output).run_full_ci).toBe('true');
    expect(calls).toHaveLength(0);
  });

  it.each([true, false])(
    'emits the PR number only when the original identity is current (fresh=%s)',
    async (fresh) => {
      const { output, env } = environment();
      const current = pullRequest();
      if (!fresh) current.head.sha = 'c'.repeat(40);
      const { fetchImpl, calls } = mockFetch([{ body: current }]);
      expect(
        await main(
          { ...env, GITHUB_EVENT_NAME: 'pull_request' },
          ['--workflow', 'ci', '--check-pr-current'],
          { fetchImpl },
        ),
      ).toBe(0);
      expect(readOutputs(output).number).toBe(fresh ? '96' : '');
      expect(calls[0].method).toBe('GET');
      expect(calls[0].timedOut).toBe(true);
    },
  );

  it('denies publication when the freshness lookup fails', async () => {
    const { output, env } = environment();
    const { fetchImpl } = mockFetch([new Error('timeout')]);
    expect(
      await main(
        { ...env, GITHUB_EVENT_NAME: 'pull_request' },
        ['--workflow', 'ci', '--check-pr-current'],
        { fetchImpl },
      ),
    ).toBe(0);
    expect(readOutputs(output).number).toBe('');
  });

  it('does not authorize a PR comment from a push', async () => {
    const { output, env } = environment();
    const { fetchImpl, calls } = mockFetch([]);
    expect(
      await main(env, ['--workflow', 'ci', '--check-pr-current'], {
        fetchImpl,
      }),
    ).toBe(0);
    expect(readOutputs(output).number).toBe('');
    expect(calls).toHaveLength(0);
  });
});
