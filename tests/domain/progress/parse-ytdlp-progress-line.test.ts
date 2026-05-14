import { parseYtdlpProgressLine } from '@src/domain/progress/parseYtdlpProgressLine';
import { describe, expect, it } from 'vitest';

describe('parseYtdlpProgressLine', () => {
  describe('main progress lines', () => {
    it('parses a standard download progress line', () => {
      const result = parseYtdlpProgressLine(
        '[download]  10.5% of  100.00MiB at    5.00MiB/s ETA 00:15',
      );
      expect(result).toEqual({
        percent: 10.5,
        speedLabel: '5.00MiB/s',
        etaLabel: '00:15',
        sizeLabel: '100.00MiB',
        stage: 'downloading',
      });
    });

    it('parses a progress line with leading spaces in percent', () => {
      const result = parseYtdlpProgressLine(
        '[download]   1.0% of   50.00MiB at    1.23MiB/s ETA 00:40',
      );
      expect(result).not.toBeNull();
      expect(result?.percent).toBe(1.0);
      expect(result?.sizeLabel).toBe('50.00MiB');
      expect(result?.etaLabel).toBe('00:40');
    });

    it('parses a progress line with KiB/s speed', () => {
      const result = parseYtdlpProgressLine(
        '[download]  55.2% of  200.00MiB at  512.00KiB/s ETA 03:12',
      );
      expect(result).not.toBeNull();
      expect(result?.percent).toBe(55.2);
      expect(result?.speedLabel).toBe('512.00KiB/s');
    });

    it('parses a progress line with GiB size', () => {
      const result = parseYtdlpProgressLine(
        '[download]  80.0% of    2.00GiB at    8.50MiB/s ETA 00:50',
      );
      expect(result).not.toBeNull();
      expect(result?.sizeLabel).toBe('2.00GiB');
    });
  });

  describe('completion lines', () => {
    it('parses the 100% completion line (with "in" instead of ETA)', () => {
      const result = parseYtdlpProgressLine(
        '[download] 100% of  100.00MiB in 00:20 at   5.12MiB/s',
      );
      expect(result).toEqual({
        percent: 100,
        speedLabel: '5.12MiB/s',
        etaLabel: 'done',
        sizeLabel: '100.00MiB',
        stage: 'done',
      });
    });

    it('parses completion line with leading spaces', () => {
      const result = parseYtdlpProgressLine(
        '[download] 100% of   50.00MiB in 00:10 at   9.99MiB/s',
      );
      expect(result?.percent).toBe(100);
      expect(result?.stage).toBe('done');
    });
  });

  describe('stage-change lines', () => {
    it('returns extracting-audio for [ExtractAudio] lines', () => {
      const result = parseYtdlpProgressLine(
        '[ExtractAudio] Destination: /tmp/video.mp3',
      );
      expect(result).toEqual({
        percent: 100,
        speedLabel: '',
        etaLabel: '',
        sizeLabel: '',
        stage: 'extracting-audio',
      });
    });

    it('returns merging for [Merger] lines', () => {
      const result = parseYtdlpProgressLine(
        '[Merger] Merging formats into "video.mp4"',
      );
      expect(result).toEqual({
        percent: 100,
        speedLabel: '',
        etaLabel: '',
        sizeLabel: '',
        stage: 'merging',
      });
    });

    it('returns merging for [ffmpeg] lines', () => {
      const result = parseYtdlpProgressLine(
        '[ffmpeg] Correcting container in "video.mp4"',
      );
      expect(result).toEqual({
        percent: 100,
        speedLabel: '',
        etaLabel: '',
        sizeLabel: '',
        stage: 'merging',
      });
    });
  });

  describe('unrecognized lines', () => {
    it('returns null for destination lines', () => {
      expect(
        parseYtdlpProgressLine('[download] Destination: video.mp4'),
      ).toBeNull();
    });

    it('returns null for empty strings', () => {
      expect(parseYtdlpProgressLine('')).toBeNull();
    });

    it('returns null for unrelated yt-dlp output', () => {
      expect(
        parseYtdlpProgressLine('[youtube] Extracting URL: ...'),
      ).toBeNull();
      expect(
        parseYtdlpProgressLine('[info] Writing video thumbnail ...'),
      ).toBeNull();
    });

    it('returns null for lines without recognized prefix', () => {
      expect(parseYtdlpProgressLine('some random text')).toBeNull();
    });
  });

  describe('carriage-return handling', () => {
    it('extracts the last progress segment from a \\r-delimited batch', () => {
      const batch =
        '[download]  10.0% of  100.00MiB at    5.00MiB/s ETA 00:18\r' +
        '[download]  20.0% of  100.00MiB at    5.00MiB/s ETA 00:16\r' +
        '[download]  30.0% of  100.00MiB at    5.00MiB/s ETA 00:14';
      const result = parseYtdlpProgressLine(batch);
      expect(result?.percent).toBe(30.0);
    });

    it('handles a line ending with \\r', () => {
      const result = parseYtdlpProgressLine(
        '[download]  42.0% of  100.00MiB at    5.00MiB/s ETA 00:10\r',
      );
      expect(result?.percent).toBe(42.0);
    });
  });
});
