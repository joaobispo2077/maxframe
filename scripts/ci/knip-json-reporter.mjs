import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

const KINDS = [
  'files',
  'dependencies',
  'devDependencies',
  'exports',
  'types',
  'duplicates',
  'unlisted',
  'unresolved',
  'enumMembers',
  'namespaceMembers',
  'binaries',
  'optionalPeerDependencies',
  'catalog',
];

function relFile(cwd, filePath) {
  return relative(cwd, filePath).replaceAll('\\', '/');
}

export function reportFromKnipIssues(issues, cwd) {
  const byFile = new Map();
  for (const kind of KINDS) {
    const group = issues?.[kind];
    if (!group || typeof group !== 'object') continue;
    for (const entries of Object.values(group)) {
      if (!entries || typeof entries !== 'object') continue;
      for (const issue of Object.values(entries)) {
        if (!issue?.filePath) continue;
        const file = relFile(cwd, issue.filePath);
        const row = byFile.get(file) ?? { file };
        const name =
          kind === 'files'
            ? file
            : typeof issue.symbol === 'string'
              ? issue.symbol
              : file;
        const list = Array.isArray(row[kind]) ? row[kind] : [];
        list.push(name);
        row[kind] = list;
        byFile.set(file, row);
      }
    }
  }
  return { issues: [...byFile.values()] };
}

export default async function knipJsonReporter({ issues, cwd }) {
  const out = process.env.KNIP_JSON_OUT || 'reports/quality/knip.json';
  const report = reportFromKnipIssues(issues, cwd);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report)}\n`);
}
