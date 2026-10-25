import { pathToFileURL } from 'node:url';

export const CI_READINESS_CHECK_NAME = 'CI readiness';
export const PUSH_SKIPPED_CHECK_NAME =
  'CI readiness (push skipped, PR validates)';
export const RELEASE_REF = 'refs/heads/release';
export const CI_WORKFLOW_PATH = '.github/workflows/ci.yml';
export const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_INTERVAL_MS = 15 * 1000;
export const DEFAULT_PER_PAGE = 100;

const MAX_PAGES = 20;
const PENDING_STATUS = new Set([
  'queued',
  'in_progress',
  'pending',
  'waiting',
  'requested',
]);

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'maxframe-release-readiness-gate',
  };
}

function assertRepo(repo) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) {
    throw new Error('GitHub repository must be owner/name');
  }
}

function assertToken(token) {
  if (!token) throw new Error('GitHub token is required');
}

export function normalizeSha(sha) {
  const value = String(sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('commit sha must be a full 40 character sha');
  }
  return value;
}

export function assertReleaseRef(ref) {
  if (ref !== RELEASE_REF) {
    throw new Error(
      `Release publishes only from ${RELEASE_REF} (got ${ref || 'empty'})`,
    );
  }
}

export function actionRunId(checkRun) {
  const url = `${checkRun?.details_url || checkRun?.html_url || ''}`;
  const match = url.match(/\/actions\/runs\/(\d+)(?:\/job\/\d+)?/);
  return match ? match[1] : null;
}

function repoParts(repo) {
  const [owner, name] = repo.split('/');
  return {
    owner: encodeURIComponent(owner),
    name: encodeURIComponent(name),
  };
}

async function fetchJson(fetchImpl, url, token) {
  let response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(token) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network error';
    throw new Error(`GitHub API request failed: ${message}`);
  }
  if (!response?.ok) {
    const status = response?.status ?? 'unknown';
    throw new Error(`GitHub API request failed: ${status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('GitHub API response was not JSON');
  }
}

function checkRunsUrl(repo, sha, perPage, page) {
  const { owner, name } = repoParts(repo);
  const url = new URL(
    `https://api.github.com/repos/${owner}/${name}/commits/${sha}/check-runs`,
  );
  url.searchParams.set('filter', 'all');
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  return url;
}

/**
 * Page through every check run. The API default page is 30, and a release
 * SHA can carry push CI, pull_request CI, and the Release workflow together.
 * `filter=all` keeps the pull_request run when a later push reused the name.
 */
export async function listCheckRuns({
  fetchImpl,
  repo,
  token,
  sha,
  perPage = DEFAULT_PER_PAGE,
}) {
  const collected = [];
  let total = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await fetchJson(
      fetchImpl,
      checkRunsUrl(repo, sha, perPage, page),
      token,
    );
    if (
      !Array.isArray(body?.check_runs) ||
      typeof body.total_count !== 'number'
    ) {
      throw new Error('check-runs response is incomplete');
    }
    if (total === null) total = body.total_count;
    if (body.total_count !== total) {
      throw new Error('check-runs total changed during pagination');
    }
    if (body.check_runs.length === 0) {
      if (collected.length < total) {
        throw new Error('check-runs pagination ended early');
      }
      break;
    }
    collected.push(...body.check_runs);
    if (collected.length >= total) break;
    if (body.check_runs.length < perPage) {
      throw new Error('check-runs pagination ended early');
    }
  }
  if (total !== null && collected.length < total) {
    throw new Error('check-runs pagination exceeded 20 pages');
  }
  return collected;
}

async function fetchWorkflowRun({ fetchImpl, repo, token, runId }) {
  const { owner, name } = repoParts(repo);
  const url = `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}`;
  const body = await fetchJson(fetchImpl, url, token);
  return {
    event: typeof body?.event === 'string' ? body.event : '',
    path: typeof body?.path === 'string' ? body.path : '',
    headSha:
      typeof body?.head_sha === 'string' ? body.head_sha.toLowerCase() : '',
  };
}

export async function fetchReleaseTip({ fetchImpl, repo, token }) {
  const { owner, name } = repoParts(repo);
  const url = `https://api.github.com/repos/${owner}/${name}/git/ref/heads/release`;
  const body = await fetchJson(fetchImpl, url, token);
  const tip = body?.object?.sha;
  if (typeof tip !== 'string' || !/^[0-9a-f]{40}$/i.test(tip)) {
    throw new Error('release tip response is missing the commit sha');
  }
  return tip.toLowerCase();
}

function missingMessage(sha, context) {
  const sentences = [
    `CI readiness check from pull_request CI is missing on ${sha}.`,
  ];
  if (context.sawPushSkipped) {
    sentences.push('The push-skipped check does not count.');
  }
  if (context.pushConclusions.length === 1) {
    sentences.push(
      `The push CI readiness check concluded ${context.pushConclusions[0]} and does not count.`,
    );
  } else if (context.pushConclusions.length > 1) {
    sentences.push(
      `Push CI readiness conclusions (${context.pushConclusions.join(', ')}) do not count.`,
    );
  }
  return sentences.join(' ');
}

function classify(sha, resolved, context) {
  if (resolved.length === 0) {
    return { state: 'missing', message: missingMessage(sha, context) };
  }
  const latest = resolved.sort((left, right) => right.id - left.id)[0];
  if (latest.status !== 'completed') {
    if (!PENDING_STATUS.has(latest.status)) {
      throw new Error(
        `CI readiness from pull_request CI has unexpected status ${latest.status || 'empty'} on ${sha}`,
      );
    }
    return { state: 'pending', status: latest.status };
  }
  if (latest.conclusion === 'success') return { state: 'success' };
  const conclusion = latest.conclusion || 'empty';
  return {
    state: 'rejected',
    message: `CI readiness from pull_request CI finished with conclusion ${conclusion} on ${sha}`,
  };
}

async function findPullRequestCiReadiness({
  fetchImpl,
  repo,
  token,
  sha,
  perPage,
}) {
  const checks = await listCheckRuns({
    fetchImpl,
    repo,
    token,
    sha,
    perPage,
  });
  const context = { sawPushSkipped: false, pushConclusions: [] };
  const resolved = [];
  for (const check of checks) {
    if (!check || check.name === PUSH_SKIPPED_CHECK_NAME) {
      if (check?.name === PUSH_SKIPPED_CHECK_NAME)
        context.sawPushSkipped = true;
      continue;
    }
    if (check.name !== CI_READINESS_CHECK_NAME) continue;
    const runId = actionRunId(check);
    if (!runId) {
      throw new Error('CI readiness check is missing its workflow run id');
    }
    const run = await fetchWorkflowRun({ fetchImpl, repo, token, runId });
    if (run.path !== CI_WORKFLOW_PATH || run.headSha !== sha) continue;
    if (run.event === 'push') {
      context.pushConclusions.push(check.conclusion || 'empty');
      continue;
    }
    if (run.event !== 'pull_request') continue;
    resolved.push({
      id: Number(check.id) || 0,
      status: check.status || '',
      conclusion: check.conclusion,
    });
  }
  return classify(sha, resolved, context);
}

export function readNonNegative(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('timeout and interval must be non-negative numbers');
  }
  return value;
}

export function optionsFromEnv(env) {
  const intervalMs = readNonNegative(
    env.CI_READINESS_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
  );
  if (intervalMs < 1) {
    throw new Error('CI_READINESS_INTERVAL_MS must be at least 1');
  }
  return {
    repo: env.GITHUB_REPOSITORY,
    token: env.GH_TOKEN || env.GITHUB_TOKEN,
    sha: env.TARGET_SHA || env.GITHUB_SHA,
    ref: env.TARGET_REF || env.GITHUB_REF,
    timeoutMs: readNonNegative(env.CI_READINESS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    intervalMs,
  };
}

/**
 * Allow publish only when the exact pull_request CI readiness check succeeded
 * and the remote release tip is still this SHA. Every other outcome throws.
 */
export async function evaluateReleaseGate({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  sha,
  ref,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
  perPage = DEFAULT_PER_PAGE,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  assertReleaseRef(ref);
  assertRepo(repo);
  assertToken(token);
  const commit = normalizeSha(sha);
  if (intervalMs < 1) {
    throw new Error('CI_READINESS_INTERVAL_MS must be at least 1');
  }
  const deadline = now() + timeoutMs;
  let decision;
  for (;;) {
    decision = await findPullRequestCiReadiness({
      fetchImpl,
      repo,
      token,
      sha: commit,
      perPage,
    });
    if (decision.state === 'success') break;
    if (decision.state === 'rejected' || decision.state === 'missing') {
      throw new Error(decision.message);
    }
    if (now() >= deadline) {
      throw new Error(
        `timed out waiting for pull_request CI readiness on ${commit}`,
      );
    }
    await sleep(intervalMs);
  }
  const tip = await fetchReleaseTip({ fetchImpl, repo, token });
  if (tip !== commit) {
    throw new Error(
      `release tip is ${tip}, not ${commit}; aborting without publishing`,
    );
  }
  return {
    publish: true,
    sha: commit,
    reason: `CI readiness from pull_request CI succeeded on ${commit} and release tip matches`,
  };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  evaluateReleaseGate(optionsFromEnv(process.env))
    .then((result) => {
      console.log(result.reason);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
