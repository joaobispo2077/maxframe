import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderBarPng } from './png-chart.mjs';
import { COVERAGE_FLOORS, DUPLICATION_CEILING } from './quality-floors.mjs';

export const CHART_START = '<!-- kpi-charts:start -->';
export const CHART_END = '<!-- kpi-charts:end -->';

function overallToken(overall) {
  if (overall === 'FAIL' || overall === 'UNKNOWN' || overall === 'PASS') {
    return overall;
  }
  return 'UNKNOWN';
}

function metricNumber(row, key) {
  const value = row?.metrics?.[key];
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function statusOf(row) {
  return row?.status || 'UNKNOWN';
}

export function chartSeries(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  return rows.map((row) => {
    if (row?.job === 'coverage') {
      const measured = metricNumber(row, 'lines');
      return {
        gate: row.gate,
        status: statusOf(row),
        kind: measured == null ? 'chip' : 'bar',
        drawn: measured,
        line: COVERAGE_FLOORS.lines,
        detail: row.value,
      };
    }
    if (row?.job === 'duplication') {
      const measured = metricNumber(row, 'percent');
      return {
        gate: row.gate,
        status: statusOf(row),
        kind: measured == null ? 'chip' : 'bar',
        drawn: measured == null ? null : 100 - measured,
        line: 100 - DUPLICATION_CEILING,
        measured,
        detail: row.value,
      };
    }
    return {
      gate: row.gate,
      status: statusOf(row),
      kind: 'chip',
      detail: row.value,
    };
  });
}

function cell(value) {
  return String(value ?? 'unavailable')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function statusCounts(series) {
  const counts = { PASS: 0, FAIL: 0, UNKNOWN: 0, INFO: 0 };
  for (const row of series) {
    const status = Object.hasOwn(counts, row.status) ? row.status : 'UNKNOWN';
    counts[status] += 1;
  }
  return counts;
}

function mermaidStatus(series) {
  const counts = statusCounts(series);
  const summary = ['PASS', 'FAIL', 'UNKNOWN', 'INFO']
    .filter((status) => status !== 'INFO' || counts[status] > 0)
    .map((status) => `${status} ${counts[status]}`)
    .join(', ');
  const slices = ['PASS', 'FAIL', 'UNKNOWN', 'INFO'].filter(
    (status) => counts[status] > 0,
  );
  if (slices.length === 0) return summary;
  const lines = ['```mermaid', 'pie showData', '    title Gate status'];
  for (const status of slices) {
    lines.push(`    "${status}" : ${counts[status]}`);
  }
  lines.push('```');
  return `${summary}\n\n${lines.join('\n')}`;
}

function table(headers, rows) {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map((value) => cell(value)).join(' | ')} |`);
  }
  return lines.join('\n');
}

function coverageRow(report) {
  return (report?.rows ?? []).find((row) => row?.job === 'coverage') ?? null;
}

export function buildChartMarkdown(report, overall) {
  const verdict = overallToken(overall);
  const series = chartSeries(report);
  const coverage = coverageRow(report);
  const duplication = (report?.rows ?? []).find(
    (row) => row?.job === 'duplication',
  );
  const complexity = (report?.rows ?? []).find(
    (row) => row?.job === 'complexity',
  );
  const deadcode = (report?.rows ?? []).find((row) => row?.job === 'deadcode');
  const audit = (report?.rows ?? []).find((row) => row?.job === 'audit');
  const architecture = (report?.rows ?? []).find(
    (row) => row?.job === 'architecture',
  );
  const lines = metricNumber(coverage, 'lines');
  const duplicated = metricNumber(duplication, 'percent');
  return [
    '## KPI charts',
    '',
    `**Overall: ${verdict}**`,
    '',
    'Charts use the same rows as the table above. They do not move a floor.',
    '',
    '### Gate status',
    '',
    mermaidStatus(series),
    '',
    table(
      ['Gate', 'Chart', 'Result'],
      series.map((row) => [
        row.gate,
        row.kind === 'bar'
          ? `${Number(row.measured ?? row.drawn).toFixed(2)}`
          : 'chip',
        row.status,
      ]),
    ),
    '',
    '### Coverage',
    '',
    table(
      ['Field', 'Value'],
      [
        ['Lines', lines == null ? 'unavailable' : `${lines.toFixed(2)}%`],
        ['Floor', `lines ${COVERAGE_FLOORS.lines}`],
        ['Result', statusOf(coverage)],
        ['Reported', coverage?.value || 'unavailable'],
      ],
    ),
    '',
    '### Complexity',
    '',
    table(
      ['Field', 'Value'],
      [
        [
          'Allowlisted',
          String(complexity?.metrics?.allowlisted ?? 'unavailable'),
        ],
        ['Over the line', String(complexity?.metrics?.over ?? 'unavailable')],
        ['Reported', complexity?.value || 'unavailable'],
      ],
    ),
    '',
    '### Dead code',
    '',
    table(
      ['Field', 'Value'],
      [
        [
          'Allowlisted',
          String(deadcode?.metrics?.allowlisted ?? 'unavailable'),
        ],
        ['Unwaived', String(deadcode?.metrics?.unwaived ?? 'unavailable')],
        ['Reported', deadcode?.value || 'unavailable'],
      ],
    ),
    '',
    '### Dependency audit',
    '',
    table(
      ['Field', 'Value'],
      [
        ['High', String(audit?.metrics?.high ?? 'unavailable')],
        ['Critical', String(audit?.metrics?.critical ?? 'unavailable')],
        ['Reported', audit?.value || 'unavailable'],
      ],
    ),
    '',
    '### Duplication',
    '',
    table(
      ['Field', 'Value'],
      [
        [
          'Duplicated lines',
          duplicated == null ? 'unavailable' : `${duplicated.toFixed(2)}%`,
        ],
        ['Ceiling', `${DUPLICATION_CEILING}%`],
        ['Reported', duplication?.value || 'unavailable'],
      ],
    ),
    '',
    '### Architecture',
    '',
    table(
      ['Field', 'Value'],
      [
        [
          'Contracts',
          String(architecture?.metrics?.contracts ?? 'unavailable'),
        ],
        [
          'Violations',
          String(architecture?.metrics?.violations ?? 'unavailable'),
        ],
        ['Reported', architecture?.value || 'unavailable'],
      ],
    ),
    '',
    '### Mutation',
    '',
    'Mutation is not part of this chart set. See the Mutation tests sticky (`mutation-report`).',
    '',
    table(
      ['Field', 'Value'],
      [
        ['Mutation', 'separate sticky'],
        ['Sticky', '`mutation-report`'],
      ],
    ),
    '',
    `<!-- chart-overall:${verdict} -->`,
    '',
  ].join('\n');
}

export function writeChartFiles(report, outDir) {
  mkdirSync(outDir, { recursive: true });
  const series = chartSeries(report);
  const files = {
    'status.png': series.map((row) => ({
      status: row.status,
      drawn: row.kind === 'bar' ? row.drawn : row.status === 'PASS' ? 100 : 8,
      line: row.line,
    })),
    'coverage.png': [
      {
        status: statusOf(coverageRow(report)),
        drawn: metricNumber(coverageRow(report), 'lines') ?? 0,
        line: COVERAGE_FLOORS.lines,
      },
    ],
    'complexity.png': [
      {
        status: statusOf(
          (report?.rows ?? []).find((row) => row?.job === 'complexity'),
        ),
        drawn: 50,
      },
    ],
    'deadcode.png': [
      {
        status: statusOf(
          (report?.rows ?? []).find((row) => row?.job === 'deadcode'),
        ),
        drawn: 50,
      },
    ],
    'deps.png': [
      {
        status: statusOf(
          (report?.rows ?? []).find((row) => row?.job === 'audit'),
        ),
        drawn: 50,
      },
    ],
    'duplication.png': [
      {
        status: statusOf(
          (report?.rows ?? []).find((row) => row?.job === 'duplication'),
        ),
        drawn:
          metricNumber(
            (report?.rows ?? []).find((row) => row?.job === 'duplication'),
            'percent',
          ) == null
            ? 0
            : 100 -
              metricNumber(
                (report?.rows ?? []).find((row) => row?.job === 'duplication'),
                'percent',
              ),
        line: 100 - DUPLICATION_CEILING,
      },
    ],
    'architecture.png': [
      {
        status: statusOf(
          (report?.rows ?? []).find((row) => row?.job === 'architecture'),
        ),
        drawn: 50,
      },
    ],
  };
  for (const [name, rows] of Object.entries(files)) {
    writeFileSync(join(outDir, name), renderBarPng(rows));
  }
  writeFileSync(
    join(outDir, 'charts.txt'),
    series
      .map((row) => `${row.gate}\t${row.status}\t${row.kind}`)
      .join('\n')
      .concat('\n'),
  );
  return files;
}
