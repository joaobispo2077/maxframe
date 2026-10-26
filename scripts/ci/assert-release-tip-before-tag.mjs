import { execFileSync } from 'node:child_process';

import { normalizeSha } from './require-release-ci-readiness.mjs';

/**
 * Last semantic-release prepare step. It runs after @semantic-release/git
 * and immediately before semantic-release creates the tag.
 *
 * HEAD must be the validated sha, or one commit whose parent is that sha
 * (the version bump). The remote release tip must equal HEAD. When the git
 * plugin has nothing to commit, HEAD is still the validated sha, so a release
 * move after the earlier tip read fails here instead of tagging the old sha.
 * A push after this read and before the tag push can still move release.
 */
export function tipFromLsRemote(stdout) {
  const sha = String(stdout || '')
    .trim()
    .split(/\s+/)[0];
  return normalizeSha(sha);
}

export function assertReleaseTipBeforeTag({ head, parent, tip, validated }) {
  const headSha = normalizeSha(head);
  const tipSha = normalizeSha(tip);
  const validatedSha = normalizeSha(validated);
  if (tipSha !== headSha) {
    throw new Error(
      `release tip is ${tipSha}, not HEAD ${headSha}; aborting before tag`,
    );
  }
  if (headSha === validatedSha)
    return { sha: headSha, validated: validatedSha };
  const parentSha = normalizeSha(parent);
  if (parentSha !== validatedSha) {
    throw new Error(
      `HEAD ${headSha} is not the validated commit ${validatedSha}; aborting before tag`,
    );
  }
  return { sha: headSha, validated: validatedSha };
}

function git(execImpl, args, { cwd, env }) {
  return execImpl('git', args, { cwd, env, encoding: 'utf8' });
}

export async function prepare(_pluginConfig, context, execImpl = execFileSync) {
  const cwd = context?.cwd || process.cwd();
  const env = context?.env || process.env;
  const repositoryUrl = context?.options?.repositoryUrl;
  if (!repositoryUrl) throw new Error('repository URL is required before tag');
  const validated = env.TARGET_SHA || env.GITHUB_SHA;
  const head = String(
    git(execImpl, ['rev-parse', 'HEAD'], { cwd, env }),
  ).trim();
  let parent = '';
  if (normalizeSha(head) !== normalizeSha(validated)) {
    parent = String(git(execImpl, ['rev-parse', 'HEAD^'], { cwd, env })).trim();
  }
  const remote = git(
    execImpl,
    ['ls-remote', '--heads', '--', repositoryUrl, 'release'],
    { cwd, env },
  );
  return assertReleaseTipBeforeTag({
    head,
    parent,
    tip: tipFromLsRemote(remote),
    validated,
  });
}
