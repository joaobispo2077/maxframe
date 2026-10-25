import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const CI_BASES = new Set(['develop', 'release', 'main']);
export const WORKFLOWS = new Set(['ci', 'engine-binary']);

const FULL = 'This event requires full validation.';
const UNCERTAIN = 'PR identity is uncertain; running full validation.';
const INCOMPLETE = 'PR response is incomplete; running full validation.';
const SKIPPED = 'An open PR validates this feature commit; push work skipped.';
const NO_PR =
  'No eligible open PR validates this commit; running full validation.';
const LOOKUP = 'PR lookup unavailable; running full validation.';
const UNMERGEABLE = 'PR mergeability is unconfirmed; running full validation.';

function own(object, key) {
  return (
    Boolean(object) &&
    typeof object === 'object' &&
    Object.prototype.hasOwnProperty.call(object, key)
  );
}

function read(object, key) {
  if (!own(object, key)) {
    const error = new TypeError('incomplete pull request');
    error.code = 'INCOMPLETE_PR';
    throw error;
  }
  return object[key];
}

function matchesPull(workflow, repository, branch, sha, pr) {
  const head = read(pr, 'head');
  const base = read(pr, 'base');
  const headRepo = read(head, 'repo');
  const baseRepo = read(base, 'repo');
  const baseRef = read(base, 'ref');
  const number = read(pr, 'number');
  return (
    read(pr, 'state') === 'open' &&
    Number.isInteger(number) &&
    number > 0 &&
    read(headRepo, 'full_name') === repository &&
    read(head, 'ref') === branch &&
    read(head, 'sha') === sha &&
    read(baseRepo, 'full_name') === repository &&
    typeof baseRef === 'string' &&
    baseRef.length > 0 &&
    (workflow === 'engine-binary' || CI_BASES.has(baseRef))
  );
}

/**
 * Decide whether this run must execute the gates.
 * Uncertain identity always runs full CI. Only an open, same-repo feature
 * push whose head matches a supported base is allowed to return false.
 */
export function selectRun(workflow, eventName, repository, branch, sha, pulls) {
  if (eventName !== 'push' || !String(branch || '').startsWith('feature/')) {
    return { run: true, reason: FULL };
  }
  if (!repository || !sha || !Array.isArray(pulls)) {
    return { run: true, reason: UNCERTAIN };
  }
  for (const pr of pulls) {
    let matches = false;
    try {
      matches = matchesPull(workflow, repository, branch, sha, pr);
    } catch (error) {
      if (error?.code === 'INCOMPLETE_PR') {
        return { run: true, reason: INCOMPLETE };
      }
      throw error;
    }
    if (matches) return { run: false, reason: SKIPPED };
  }
  return { run: true, reason: NO_PR };
}

/**
 * Publication is allowed only when the event PR is still open and every
 * head and base sha, ref, and repo still match the event payload.
 */
export function isCurrentPr(event, current, repository) {
  try {
    const expected = read(event, 'pull_request');
    const number = read(current, 'number');
    if (
      !repository ||
      read(current, 'state') !== 'open' ||
      !Number.isInteger(number) ||
      number !== read(event, 'number')
    ) {
      return false;
    }
    for (const side of ['head', 'base']) {
      const expectedSide = read(expected, side);
      const currentSide = read(current, side);
      for (const field of ['sha', 'ref']) {
        const value = read(expectedSide, field);
        if (
          typeof value !== 'string' ||
          value.length === 0 ||
          read(currentSide, field) !== value
        ) {
          return false;
        }
      }
      const source = read(read(expectedSide, 'repo'), 'full_name');
      if (
        typeof source !== 'string' ||
        source.length === 0 ||
        read(read(currentSide, 'repo'), 'full_name') !== source
      ) {
        return false;
      }
    }
    return (
      read(read(read(expected, 'base'), 'repo'), 'full_name') === repository
    );
  } catch (error) {
    if (error?.code === 'INCOMPLETE_PR') return false;
    throw error;
  }
}

export async function githubApi(
  endpoint,
  { token, fetchImpl, timeoutMs, query },
) {
  const url = new URL(`https://api.github.com/${endpoint.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(query || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'maxframe-select-ci-run',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`github api failed: ${response.status}`);
  }
  return response.json();
}

function writeOutput(env, name, value) {
  if (!env.GITHUB_OUTPUT) return;
  const line = `${name}=${String(value).replace(/[\r\n]/g, ' ')}`;
  appendFileSync(env.GITHUB_OUTPUT, `${line}\n`);
}

function writeSummary(env, reason) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## CI selection\n\n${reason}\n`);
}

function parseArgs(argv) {
  const workflowAt = argv.indexOf('--workflow');
  const workflow = workflowAt >= 0 ? argv[workflowAt + 1] : '';
  return {
    workflow,
    checkPrCurrent: argv.includes('--check-pr-current'),
  };
}

async function checkPrCurrent(env, repository, fetchImpl, timeoutMs) {
  let number = '';
  try {
    if (env.GITHUB_EVENT_NAME === 'pull_request' && repository) {
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
      const candidate = event.number;
      if (Number.isInteger(candidate) && candidate > 0) {
        const current = await githubApi(
          `repos/${repository}/pulls/${candidate}`,
          {
            token: env.GH_TOKEN || env.GITHUB_TOKEN || '',
            fetchImpl,
            timeoutMs,
          },
        );
        if (isCurrentPr(event, current, repository)) number = String(candidate);
      }
    }
  } catch {
    number = '';
  }
  writeOutput(env, 'number', number);
  console.log(number ? 'PR publication permitted.' : 'PR publication skipped.');
  return 0;
}

export async function main(
  env = process.env,
  argv = process.argv.slice(2),
  deps = {},
) {
  const { workflow, checkPrCurrent: checkCurrent } = parseArgs(argv);
  if (!WORKFLOWS.has(workflow)) {
    console.error('workflow must be ci or engine-binary');
    return 1;
  }
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const timeoutMs = deps.timeoutMs || 20000;
  const repository = env.GITHUB_REPOSITORY || '';
  if (checkCurrent) {
    return checkPrCurrent(env, repository, fetchImpl, timeoutMs);
  }

  const eventName = env.GITHUB_EVENT_NAME || '';
  const branch = env.GITHUB_REF_NAME || '';
  const sha = env.GITHUB_SHA || '';
  let decision = { run: true, reason: FULL };
  try {
    let pulls = [];
    if (eventName === 'push' && branch.startsWith('feature/')) {
      if (!repository || !sha) {
        throw new Error('Missing repository or commit identity');
      }
      const owner = repository.split('/')[0];
      pulls = await githubApi(`repos/${repository}/pulls`, {
        token: env.GH_TOKEN || env.GITHUB_TOKEN || '',
        fetchImpl,
        timeoutMs,
        query: {
          state: 'open',
          head: `${owner}:${branch}`,
          per_page: '100',
        },
      });
    }
    decision = selectRun(workflow, eventName, repository, branch, sha, pulls);
    if (!decision.run) {
      const candidate = pulls.find(
        (pr) =>
          !selectRun(workflow, eventName, repository, branch, sha, [pr]).run,
      );
      const current = await githubApi(
        `repos/${repository}/pulls/${candidate.number}`,
        {
          token: env.GH_TOKEN || env.GITHUB_TOKEN || '',
          fetchImpl,
          timeoutMs,
        },
      );
      decision = selectRun(workflow, eventName, repository, branch, sha, [
        current,
      ]);
      if (!decision.run && current?.mergeable !== true) {
        decision = { run: true, reason: UNMERGEABLE };
      }
    }
  } catch {
    decision = { run: true, reason: LOOKUP };
  }
  writeOutput(env, 'run_full_ci', String(decision.run));
  writeOutput(env, 'reason', decision.reason);
  writeSummary(env, decision.reason);
  console.log(decision.reason);
  return 0;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
