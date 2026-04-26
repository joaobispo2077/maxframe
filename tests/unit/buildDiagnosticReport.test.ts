import { describe, expect, it } from 'vitest';

import { buildDiagnosticReport } from '@src/infrastructure/diagnostics/buildDiagnosticReport.js';
import type { DiagnosticsReport } from '@src/interface/ipc/getDiagnosticsHandler.js';

const BASE_REPORT: DiagnosticsReport = {
  ytdlpPath: '/usr/local/bin/yt-dlp',
  ytdlpFound: true,
  ffmpegPath: 'ffmpeg',
  ffmpegFound: false,
  platform: 'linux',
  arch: 'x64',
  appVersion: '1.0.1',
  pathEnv: '/usr/local/bin:/usr/bin',
  lastError: undefined,
};

describe('buildDiagnosticReport', () => {
  it('contains the header banner', () => {
    const report = buildDiagnosticReport(BASE_REPORT);
    expect(report).toContain('=== Maxframe Diagnostic Report ===');
  });

  it('shows [FOUND] when ytdlpFound is true', () => {
    const report = buildDiagnosticReport({ ...BASE_REPORT, ytdlpFound: true });
    expect(report).toContain('[FOUND]');
  });

  it('shows [NOT FOUND] when ytdlpFound is false', () => {
    const report = buildDiagnosticReport({ ...BASE_REPORT, ytdlpFound: false });
    expect(report).toContain('[NOT FOUND]');
  });

  it('shows (none) when lastError is undefined', () => {
    const report = buildDiagnosticReport({
      ...BASE_REPORT,
      lastError: undefined,
    });
    expect(report).toContain('(none)');
  });

  it('shows the actual error when lastError is set', () => {
    const report = buildDiagnosticReport({
      ...BASE_REPORT,
      lastError: 'yt-dlp not found',
    });
    expect(report).toContain('yt-dlp not found');
  });

  it('ends with a valid JSON block (last section parseable)', () => {
    const report = buildDiagnosticReport(BASE_REPORT);
    const jsonMarker = '--- JSON ---';
    const jsonIndex = report.indexOf(jsonMarker);
    expect(jsonIndex).toBeGreaterThan(-1);
    const jsonSection = report.slice(jsonIndex + jsonMarker.length).trim();
    expect(() => JSON.parse(jsonSection)).not.toThrow();
    const parsed = JSON.parse(jsonSection) as DiagnosticsReport;
    expect(parsed.appVersion).toBe('1.0.1');
  });

  it('contains yt-dlp and ffmpeg path info', () => {
    const report = buildDiagnosticReport(BASE_REPORT);
    expect(report).toContain('/usr/local/bin/yt-dlp');
    expect(report).toContain('ffmpeg');
  });
});
