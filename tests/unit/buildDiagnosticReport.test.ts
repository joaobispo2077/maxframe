import type { DiagnosticsReport } from '@src/interface/ipc/getDiagnosticsHandler.js';

import { buildDiagnosticReport } from '@src/infrastructure/diagnostics/buildDiagnosticReport.js';
import { describe, expect, it } from 'vitest';

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
  lastErrorDetail: undefined,
  lastSubmittedUrl: undefined,
  ytdlpVersion: undefined,
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

  it('shows technical last error, submitted URL, and yt-dlp version sections', () => {
    const report = buildDiagnosticReport({
      ...BASE_REPORT,
      lastErrorDetail: 'ERROR: signature extraction failed',
      lastSubmittedUrl:
        'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
      ytdlpVersion: '2026.03.17',
    });
    expect(report).toContain('--- Last Error (technical) ---');
    expect(report).toContain('ERROR: signature extraction failed');
    expect(report).toContain('--- Submitted URL ---');
    expect(report).toContain('list=RDZt62nsFLqA0');
    expect(report).toContain('--- yt-dlp version ---');
    expect(report).toContain('2026.03.17');
  });
});
