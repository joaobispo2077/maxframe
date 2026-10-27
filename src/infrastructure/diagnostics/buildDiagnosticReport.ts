import {
  maskKnownUserNames,
  profileNameFromHome,
  windowsUserNamesIn,
} from '../../domain/diagnostics/maskWindowsUser.js';

const OMITTED_PATH = '(omitted)';

export type DiagnosticReportInput = {
  ytdlpPath: string;
  ytdlpFound: boolean;
  ffmpegPath: string;
  ffmpegFound: boolean;
  platform: string;
  arch: string;
  appVersion: string;
  pathEnv: string;
  lastError: string | undefined;
  lastErrorDetail: string | undefined;
  lastSubmittedUrl: string | undefined;
  ytdlpVersion: string | undefined;
};

function statusLabel(found: boolean): string {
  return found ? 'Found' : 'Missing';
}

function maskOptional(
  value: string | undefined,
  names: readonly string[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return maskKnownUserNames(value, names);
}

function namesInReport(
  report: DiagnosticReportInput,
  homeDir: string,
): string[] {
  const found = windowsUserNamesIn(
    [
      report.ytdlpPath,
      report.ffmpegPath,
      report.pathEnv,
      report.lastError ?? '',
      report.lastErrorDetail ?? '',
      report.lastSubmittedUrl ?? '',
      homeDir,
    ].join('\n'),
  );
  const homeName = profileNameFromHome(homeDir);
  if (
    homeName &&
    !found.some((name) => name.toLowerCase() === homeName.toLowerCase())
  ) {
    found.push(homeName);
  }
  return found;
}

/** Paths masked and PATH removed. Safe to show on screen and to copy. */
export function maskDiagnosticReport(
  report: DiagnosticReportInput,
  options?: { homeDir?: string },
): DiagnosticReportInput {
  const names = namesInReport(report, options?.homeDir ?? '');
  return {
    ...report,
    ytdlpPath: maskKnownUserNames(report.ytdlpPath, names),
    ffmpegPath: maskKnownUserNames(report.ffmpegPath, names),
    lastError: maskOptional(report.lastError, names),
    lastErrorDetail: maskOptional(report.lastErrorDetail, names),
    lastSubmittedUrl: maskOptional(report.lastSubmittedUrl, names),
    pathEnv: OMITTED_PATH,
  };
}

export function buildDiagnosticReport(report: DiagnosticReportInput): string {
  const masked = maskDiagnosticReport(report);
  const lines = [
    '=== Maxframe Diagnostic Report ===',
    `Generated: ${new Date().toISOString()}`,
    `App: ${masked.appVersion} | Platform: ${masked.platform} (${masked.arch})`,
    '',
    '--- Tool Resolution ---',
    `yt-dlp:  ${masked.ytdlpPath}  ${statusLabel(masked.ytdlpFound)}`,
    `ffmpeg:  ${masked.ffmpegPath}  ${statusLabel(masked.ffmpegFound)}`,
    '',
    '--- Last Error ---',
    masked.lastError ?? '(none)',
    '',
    '--- Last Error (technical) ---',
    masked.lastErrorDetail ?? '(none)',
    '',
    '--- Submitted URL ---',
    masked.lastSubmittedUrl ?? '(none)',
    '',
    '--- yt-dlp version ---',
    masked.ytdlpVersion ?? '(unknown)',
    '',
    '--- JSON ---',
    JSON.stringify(masked, null, 2),
  ];
  return lines.join('\n');
}
