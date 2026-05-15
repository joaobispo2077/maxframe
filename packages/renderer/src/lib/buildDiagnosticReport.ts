import type { DiagnosticsReport } from '../maxframe-api.js';

function found(v: boolean): string {
  return v ? '[FOUND]' : '[NOT FOUND]';
}

export function buildDiagnosticReport(report: DiagnosticsReport): string {
  const lines = [
    '=== Maxframe Diagnostic Report ===',
    `Generated: ${new Date().toISOString()}`,
    `App: ${report.appVersion} | Platform: ${report.platform} (${report.arch})`,
    '',
    '--- Tool Resolution ---',
    `yt-dlp:  ${report.ytdlpPath}  ${found(report.ytdlpFound)}`,
    `ffmpeg:  ${report.ffmpegPath}  ${found(report.ffmpegFound)}`,
    '',
    '--- Last Error ---',
    report.lastError ?? '(none)',
    '',
    '--- Last Error (technical) ---',
    report.lastErrorDetail ?? '(none)',
    '',
    '--- Submitted URL ---',
    report.lastSubmittedUrl ?? '(none)',
    '',
    '--- yt-dlp version ---',
    report.ytdlpVersion ?? '(unknown)',
    '',
    '--- Environment ---',
    `PATH (first 500 chars): ${report.pathEnv}`,
    '',
    '--- JSON ---',
    JSON.stringify(report, null, 2),
  ];
  return lines.join('\n');
}
