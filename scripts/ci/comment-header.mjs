export const QUALITY_GATE_COMMENT_HEADER = [
  '<img src="https://raw.githubusercontent.com/joaobispo2077/avo/main/.github/bot-avatars/quality-gate-devsecops.png" width="48" height="48" alt="Quality Gate DevSecOps (Young Zangetsu)">',
  '',
  '**Quality Gate DevSecOps** (Young Zangetsu)',
].join('\n');

export function withQualityGateHeader(body) {
  return `${QUALITY_GATE_COMMENT_HEADER}\n\n${body}`;
}
