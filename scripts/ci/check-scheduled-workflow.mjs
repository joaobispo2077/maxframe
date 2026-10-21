import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function warningForWorkflowState(state) {
  if (state === 'active') return null;
  const label = state ? String(state) : 'unknown';
  return `Stryker full weekly workflow is ${label}. The cron will not run until the workflow is enabled again.`;
}

export async function checkScheduledWorkflow({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  workflow = 'stryker-full.yml',
}) {
  if (!repo || !token) {
    throw new Error(
      'GitHub repository and token are required to read the workflow state',
    );
  }
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'maxframe-scheduled-workflow-check',
    },
  });
  if (!response.ok) {
    throw new Error(`workflow state request failed: ${response.status}`);
  }
  const body = await response.json();
  const state = typeof body.state === 'string' ? body.state : '';
  return { state: state || null, warning: warningForWorkflowState(state) };
}

function emitWarning(message) {
  console.log(`::warning::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  checkScheduledWorkflow({
    repo: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    workflow: process.env.SCHEDULED_WORKFLOW || 'stryker-full.yml',
  })
    .then(({ state, warning }) => {
      if (warning) {
        emitWarning(warning);
        return;
      }
      console.log(`Stryker full weekly workflow is ${state}.`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
