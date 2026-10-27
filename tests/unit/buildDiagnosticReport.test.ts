import type { DiagnosticsReport } from '@src/interface/ipc/getDiagnosticsHandler.js';

import {
  buildDiagnosticReport,
  maskDiagnosticReport,
} from '@src/infrastructure/diagnostics/buildDiagnosticReport.js';
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

  it('shows Found when ytdlpFound is true', () => {
    const report = buildDiagnosticReport({ ...BASE_REPORT, ytdlpFound: true });
    expect(report).toContain('yt-dlp:  /usr/local/bin/yt-dlp  Found');
    expect(report).not.toContain('[FOUND]');
    expect(report).not.toContain('[Found]');
  });

  it('shows Missing when ytdlpFound is false', () => {
    const report = buildDiagnosticReport({ ...BASE_REPORT, ytdlpFound: false });
    expect(report).toContain('yt-dlp:  /usr/local/bin/yt-dlp  Missing');
    expect(report).not.toContain('NOT FOUND');
    expect(report).not.toContain('[Missing]');
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

  it('leaves out the full PATH', () => {
    const report = buildDiagnosticReport(BASE_REPORT);
    expect(report).not.toContain(BASE_REPORT.pathEnv);
    expect(report).not.toContain('PATH (first 500 chars)');
    expect(report).not.toContain('--- Environment ---');
    const parsed = JSON.parse(
      report.slice(report.indexOf('--- JSON ---') + '--- JSON ---'.length),
    ) as { pathEnv: string };
    expect(parsed.pathEnv).toBe('(omitted)');
  });

  it('masks the Windows user name and labels tools Found and Missing', () => {
    const report = buildDiagnosticReport({
      ...BASE_REPORT,
      ytdlpPath: 'C:\\Users\\Joao\\AppData\\yt-dlp.exe',
      ytdlpFound: true,
      ffmpegPath: 'C:/Users/Joao/ffmpeg/ffmpeg.exe',
      ffmpegFound: false,
      pathEnv: 'C:\\Users\\Joao\\bin;C:\\Windows\\system32',
      lastError:
        'USERPROFILE=C:\\Users\\Joao\nHOMEPATH=\\Users\\Joao\nUSERNAME=Joao',
      lastErrorDetail: 'c:\\users\\JOAO\\debug.log',
      lastSubmittedUrl: 'https://www.youtube.com/watch?v=abc',
    });
    expect(report).toContain('Found');
    expect(report).toContain('Missing');
    expect(report).not.toContain('[FOUND]');
    expect(report).not.toContain('[NOT FOUND]');
    expect(report).not.toMatch(/joao/i);
    expect(report).toContain('C:\\Users\\<user>\\AppData\\yt-dlp.exe');
    expect(report).toContain('C:/Users/<user>/ffmpeg/ffmpeg.exe');
    expect(report).toContain('USERPROFILE=C:\\Users\\<user>');
    expect(report).toContain('HOMEPATH=\\Users\\<user>');
    expect(report).toContain('USERNAME=<user>');
    expect(report).not.toContain('C:\\Users\\Joao\\bin');
    expect(report).toContain('https://www.youtube.com/watch?v=abc');
  });

  it('masks a profile that lives outside C:\\Users via the home directory', () => {
    const masked = maskDiagnosticReport(
      {
        ...BASE_REPORT,
        ytdlpPath: 'D:\\Profiles\\João\\yt-dlp.exe',
        ffmpegPath: 'D:\\Profiles\\João\\ffmpeg.exe',
        pathEnv: 'D:\\Profiles\\João\\bin',
        lastError: 'USERNAME=João\nHOMEPATH=\\Profiles\\João',
        lastErrorDetail: 'file:///D:/Profiles/João/debug.log',
        lastSubmittedUrl: 'https://www.youtube.com/watch?v=abc',
      },
      { homeDir: 'D:\\Profiles\\João' },
    );
    const report = buildDiagnosticReport({
      ...BASE_REPORT,
      ...masked,
      pathEnv: 'D:\\Profiles\\João\\bin',
    });
    expect(JSON.stringify(masked)).not.toMatch(/joão/i);
    expect(masked.ytdlpPath).toBe('D:\\Profiles\\<user>\\yt-dlp.exe');
    expect(masked.pathEnv).toBe('(omitted)');
    expect(report).not.toMatch(/joão/i);
    expect(report).toContain('USERNAME=<user>');
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
