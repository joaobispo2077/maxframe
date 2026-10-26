import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Publish gate for the Release workflow.
 *
 * A merge commit is allowed only when its first parent equals the base that
 * the counted pull_request CI run tested. That base is the pull request base
 * sha recorded in the ci-readiness artifact, and it must also be the first
 * parent of the run's merge ref. If those two disagree, or the merge commit
 * first parent differs, the job fails closed. The stale case is a release
 * move after CI: the pull request base sha at merge time equals the new
 * first parent, while the run still records the older base.
 *
 * This script reads the remote release tip once, immediately before
 * `npm run release`. `scripts/ci/assert-release-tip-before-tag.mjs` reads it
 * again as the last semantic-release prepare step, immediately before the
 * tag. HEAD must be the validated sha, or the version-bump commit whose
 * parent is that sha, and the remote tip must equal HEAD. That covers the
 * case where @semantic-release/git has nothing to commit. A push after that
 * second read and before the tag push can still move release.
 *
 * CI_READINESS_SKIP_RELEASE_TIP_CHECK skips only this script's tip read.
 * The only enabling value is the exact string 1. Any other non-empty value
 * throws. The script also rejects 1 when GITHUB_EVENT_NAME is push or
 * workflow_dispatch, and when GITHUB_WORKFLOW is Release.
 */

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
    runAttempt: Number.isInteger(body?.run_attempt) ? body.run_attempt : 0,
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

function pullsForCommitUrl(repo, sha, page) {
  const { owner, name } = repoParts(repo);
  const url = new URL(
    `https://api.github.com/repos/${owner}/${name}/commits/${sha}/pulls`,
  );
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', String(page));
  return url;
}

async function listPullsForCommit({ fetchImpl, repo, token, sha }) {
  const collected = [];
  for (let page = 1; page <= 5; page += 1) {
    const body = await fetchJson(
      fetchImpl,
      pullsForCommitUrl(repo, sha, page),
      token,
    );
    if (!Array.isArray(body)) {
      throw new Error('associated pulls response is incomplete');
    }
    for (const pull of body) {
      if (!Number.isInteger(pull?.number) || pull.number <= 0) {
        throw new Error('associated pulls response is incomplete');
      }
    }
    collected.push(...body);
    if (body.length < 100) return collected;
  }
  throw new Error('associated pulls pagination exceeded 5 pages');
}

function readConfirmedPull(body, repo) {
  const head = body?.head?.sha;
  const baseRef = body?.base?.ref;
  if (typeof head !== 'string' || typeof baseRef !== 'string') {
    throw new Error('pull request response is incomplete');
  }
  const baseRepo = body?.base?.repo?.full_name;
  if (typeof baseRepo === 'string' && baseRepo !== repo) {
    return null;
  }
  const merge = body?.merge_commit_sha;
  const baseSha = body?.base?.sha;
  return {
    number: body.number,
    merged: body.merged === true,
    baseRef,
    baseSha: typeof baseSha === 'string' ? baseSha.toLowerCase() : '',
    headSha: head.toLowerCase(),
    mergeCommitSha:
      typeof merge === 'string' && merge ? merge.toLowerCase() : null,
  };
}

async function confirmPull({ fetchImpl, repo, token, number }) {
  const { owner, name } = repoParts(repo);
  const url = `https://api.github.com/repos/${owner}/${name}/pulls/${number}`;
  const body = await fetchJson(fetchImpl, url, token);
  return readConfirmedPull(body, repo);
}

/**
 * Exactly one merged pull request into release may promote this SHA.
 * A merge commit matches merge_commit_sha. A fast-forward matches head.sha.
 */
export async function resolveReleasePromotion({ fetchImpl, repo, token, sha }) {
  const listed = await listPullsForCommit({ fetchImpl, repo, token, sha });
  const matches = [];
  for (const listedPull of listed) {
    const pull = await confirmPull({
      fetchImpl,
      repo,
      token,
      number: listedPull.number,
    });
    if (!pull || !pull.merged || pull.baseRef !== 'release') continue;
    if (pull.headSha === sha) {
      matches.push({
        kind: 'fast-forward',
        headSha: pull.headSha,
        number: pull.number,
        baseSha: pull.baseSha,
      });
      continue;
    }
    if (pull.mergeCommitSha === sha) {
      matches.push({
        kind: 'merge',
        headSha: pull.headSha,
        number: pull.number,
        baseSha: pull.baseSha,
      });
    }
  }
  if (matches.length === 0) {
    throw new Error(`no associated pull request for ${sha}`);
  }
  if (matches.length > 1) {
    throw new Error(`more than one pull request is associated with ${sha}`);
  }
  return matches[0];
}

async function fetchCommitParents({ fetchImpl, repo, token, sha }) {
  const { owner, name } = repoParts(repo);
  const url = `https://api.github.com/repos/${owner}/${name}/commits/${sha}`;
  const body = await fetchJson(fetchImpl, url, token);
  if (!Array.isArray(body?.parents)) {
    throw new Error('commit response is missing parents');
  }
  return body.parents.map((parent) =>
    typeof parent?.sha === 'string' ? parent.sha.toLowerCase() : '',
  );
}

async function assertMergeSecondParent({
  fetchImpl,
  repo,
  token,
  sha,
  headSha,
}) {
  const parents = await fetchCommitParents({ fetchImpl, repo, token, sha });
  const second = parents[1] || 'missing';
  if (parents.length !== 2 || second !== headSha) {
    throw new Error(
      `parent mismatch for ${sha}: pull request head ${headSha} is not the merge commit second parent ${second}`,
    );
  }
  return parents;
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

/**
 * Latest attempt wins. Check run ids increase when a job is re-run, including
 * a new attempt of the same workflow run. A later success replaces an earlier
 * failure. A later failure replaces an earlier success. An older attempt never
 * overrides the newest one.
 */
function classify(sha, resolved, context) {
  if (resolved.length === 0) {
    return { state: 'missing', message: missingMessage(sha, context) };
  }
  const latest = resolved.slice().sort((left, right) => right.id - left.id)[0];
  if (latest.status !== 'completed') {
    if (!PENDING_STATUS.has(latest.status)) {
      throw new Error(
        `CI readiness from pull_request CI has unexpected status ${latest.status || 'empty'} on ${sha}`,
      );
    }
    return { state: 'pending', status: latest.status };
  }
  if (latest.conclusion === 'success') {
    return {
      state: 'success',
      runId: latest.runId,
      runAttempt: latest.runAttempt,
    };
  }
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
      runId,
      runAttempt: run.runAttempt,
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

export function skipReleaseTipCheckFromEnv(raw) {
  if (raw == null || raw === '') return false;
  if (raw === '1') return true;
  throw new Error(
    'CI_READINESS_SKIP_RELEASE_TIP_CHECK must be unset or the exact value 1',
  );
}

export function assertSkipReleaseTipCheckAllowed({
  skipReleaseTipCheck,
  eventName,
  workflowName,
}) {
  if (skipReleaseTipCheck !== true) return;
  if (eventName === 'push' || eventName === 'workflow_dispatch') {
    throw new Error(
      `CI_READINESS_SKIP_RELEASE_TIP_CHECK cannot be set when GITHUB_EVENT_NAME is ${eventName}`,
    );
  }
  if (workflowName === 'Release') {
    throw new Error(
      'CI_READINESS_SKIP_RELEASE_TIP_CHECK cannot be set when GITHUB_WORKFLOW is Release',
    );
  }
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
    skipReleaseTipCheck: skipReleaseTipCheckFromEnv(
      env.CI_READINESS_SKIP_RELEASE_TIP_CHECK,
    ),
    eventName: env.GITHUB_EVENT_NAME || '',
    workflowName: env.GITHUB_WORKFLOW || '',
  };
}

export function testedBaseFromReport(report, { headSha, pullNumber, runId }) {
  const pull = report?.pullRequest;
  const baseSha = String(pull?.baseSha || '').toLowerCase();
  const recordedHead = String(pull?.headSha || '').toLowerCase();
  const recordedNumber = String(pull?.number ?? '');
  const mergeSha = String(report?.sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(baseSha) || !/^[0-9a-f]{40}$/.test(mergeSha)) {
    throw new Error(
      `CI readiness report for run ${runId} is missing the tested base`,
    );
  }
  if (recordedHead !== headSha || recordedNumber !== String(pullNumber)) {
    throw new Error(
      `base mismatch for run ${runId}: report is for pull request ${recordedNumber || 'none'} head ${recordedHead || 'missing'}, not ${pullNumber} head ${headSha}`,
    );
  }
  return { baseSha, mergeSha };
}

export function assertRunMergeRef(parents, { headSha, baseSha, runId }) {
  const first = parents[0] || 'missing';
  const second = parents[1] || 'missing';
  if (parents.length !== 2 || first !== baseSha || second !== headSha) {
    throw new Error(
      `base mismatch for run ${runId}: merge ref base ${first} does not match recorded pull request base ${baseSha}`,
    );
  }
}

export function assertMergeFirstParent({
  first,
  testedBase,
  prBaseSha,
  commit,
  runId,
}) {
  if (first === testedBase) return;
  if (prBaseSha && prBaseSha === first) {
    throw new Error(
      `stale base for ${commit}: pull_request CI run ${runId} tested ${testedBase}, merge commit first parent is ${first}`,
    );
  }
  throw new Error(
    `base mismatch for ${commit}: pull_request CI run ${runId} tested ${testedBase}, merge commit first parent is ${first}`,
  );
}

function readReportFromZip(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-readiness-'));
  const zipPath = join(dir, 'artifact.zip');
  try {
    writeFileSync(zipPath, Buffer.from(bytes));
    const stdout = execFileSync('unzip', ['-p', zipPath, 'ci-readiness.json'], {
      encoding: 'utf8',
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('CI readiness report was not JSON');
    }
    throw new Error('CI readiness artifact is missing ci-readiness.json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function fetchArtifactZip(fetchImpl, url, token, redirect = false) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    headers: redirect
      ? { 'User-Agent': 'maxframe-release-readiness-gate' }
      : githubHeaders(token),
  });
  if (!redirect && response?.status >= 300 && response.status < 400) {
    const location = response.headers?.get?.('location');
    if (!location) {
      throw new Error('CI readiness artifact redirect is missing a location');
    }
    return fetchArtifactZip(fetchImpl, location, token, true);
  }
  if (!response?.ok) {
    const status = response?.status ?? 'unknown';
    throw new Error(`CI readiness artifact request failed: ${status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function loadCiReadinessReport({
  fetchImpl,
  repo,
  token,
  runId,
  runAttempt,
}) {
  if (!runId || !Number.isInteger(runAttempt) || runAttempt < 1) {
    throw new Error(`CI readiness run ${runId || 'missing'} has no attempt`);
  }
  const { owner, name } = repoParts(repo);
  const artifactName = `ci-readiness-attempt-${runAttempt}`;
  const collected = [];
  for (let page = 1; page <= 5; page += 1) {
    const url = `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`;
    const body = await fetchJson(fetchImpl, url, token);
    if (!Array.isArray(body?.artifacts)) {
      throw new Error('CI readiness artifact list is incomplete');
    }
    collected.push(...body.artifacts);
    if (body.artifacts.length < 100) break;
  }
  const match = collected.find(
    (item) => item?.name === artifactName && item.expired !== true && item.id,
  );
  if (!match) {
    throw new Error(
      `CI readiness artifact ${artifactName} for run ${runId} is missing`,
    );
  }
  const zipUrl = `https://api.github.com/repos/${owner}/${name}/actions/artifacts/${match.id}/zip`;
  const bytes = await fetchArtifactZip(fetchImpl, zipUrl, token);
  return readReportFromZip(bytes);
}

/**
 * Allow publish only when the merged pull request's head has an exact
 * pull_request CI readiness success and the remote release tip is still this
 * SHA. A missing check is polled until the deadline. Every other outcome throws.
 * `skipReleaseTipCheck` is the dry-run flag. The Release job leaves it false.
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
  skipReleaseTipCheck = false,
  eventName = '',
  workflowName = '',
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  assertReleaseRef(ref);
  assertRepo(repo);
  assertToken(token);
  assertSkipReleaseTipCheckAllowed({
    skipReleaseTipCheck,
    eventName,
    workflowName,
  });
  const commit = normalizeSha(sha);
  if (intervalMs < 1) {
    throw new Error('CI_READINESS_INTERVAL_MS must be at least 1');
  }
  const promotion = await resolveReleasePromotion({
    fetchImpl,
    repo,
    token,
    sha: commit,
  });
  let promotionParents = null;
  if (promotion.kind === 'merge') {
    promotionParents = await assertMergeSecondParent({
      fetchImpl,
      repo,
      token,
      sha: commit,
      headSha: promotion.headSha,
    });
  }
  const deadline = now() + timeoutMs;
  let decision;
  for (;;) {
    decision = await findPullRequestCiReadiness({
      fetchImpl,
      repo,
      token,
      sha: promotion.headSha,
      perPage,
    });
    if (decision.state === 'success') break;
    if (decision.state === 'rejected') throw new Error(decision.message);
    if (now() >= deadline) {
      if (decision.state === 'missing') throw new Error(decision.message);
      throw new Error(
        `timed out waiting for pull_request CI readiness on ${promotion.headSha}`,
      );
    }
    await sleep(intervalMs);
  }
  if (promotion.kind === 'merge') {
    const report = await loadCiReadinessReport({
      fetchImpl,
      repo,
      token,
      runId: decision.runId,
      runAttempt: decision.runAttempt,
    });
    const tested = testedBaseFromReport(report, {
      headSha: promotion.headSha,
      pullNumber: promotion.number,
      runId: decision.runId,
    });
    const mergeRefParents = await fetchCommitParents({
      fetchImpl,
      repo,
      token,
      sha: tested.mergeSha,
    });
    assertRunMergeRef(mergeRefParents, {
      headSha: promotion.headSha,
      baseSha: tested.baseSha,
      runId: decision.runId,
    });
    assertMergeFirstParent({
      first: promotionParents[0] || 'missing',
      testedBase: tested.baseSha,
      prBaseSha: promotion.baseSha,
      commit,
      runId: decision.runId,
    });
  }
  if (skipReleaseTipCheck !== true) {
    const tip = await fetchReleaseTip({ fetchImpl, repo, token });
    if (tip !== commit) {
      throw new Error(
        `release tip is ${tip}, not ${commit}; aborting without publishing`,
      );
    }
  }
  const checked =
    promotion.kind === 'merge'
      ? `CI readiness from pull_request CI succeeded on ${promotion.headSha} for merge commit ${commit}`
      : `CI readiness from pull_request CI succeeded on ${commit}`;
  const tipNote =
    skipReleaseTipCheck === true
      ? 'release tip check skipped'
      : 'release tip matches';
  return {
    publish: true,
    sha: commit,
    headSha: promotion.headSha,
    reason: `${checked} and ${tipNote}`,
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
