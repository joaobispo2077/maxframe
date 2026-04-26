import { buildVideoFilename } from '@src/infrastructure/youtube/buildVideoFilename';
import { describe, expect, it } from 'vitest';

describe('buildVideoFilename', () => {
  it('builds a normal mp4 filename', () => {
    expect(buildVideoFilename('How to study', 'Ultra Teacher', 'mp4')).toBe(
      'How to study - Ultra Teacher.mp4',
    );
  });

  it('builds a mp3 filename with correct extension', () => {
    expect(buildVideoFilename('Song', 'Artist', 'mp3')).toBe(
      'Song - Artist.mp3',
    );
  });

  it('removes colons and slashes from the title', () => {
    expect(buildVideoFilename('Video: Part/1', 'Channel', 'mp4')).toBe(
      'Video Part1 - Channel.mp4',
    );
  });

  it('removes asterisks from the uploader', () => {
    expect(buildVideoFilename('Title', 'Chan*nel', 'mp4')).toBe(
      'Title - Channel.mp4',
    );
  });

  it('strips all Windows-forbidden chars from title', () => {
    const title = 'A\\B/C:D*E?F"G<H>I|J';
    expect(buildVideoFilename(title, 'Author', 'mp4')).toBe(
      'ABCDEFGHIJ - Author.mp4',
    );
  });

  it('uses Unknown Channel when uploader is empty string', () => {
    expect(buildVideoFilename('My Video', '', 'mp4')).toBe(
      'My Video - Unknown Channel.mp4',
    );
  });

  it('uses Unknown Channel when uploader becomes empty after stripping', () => {
    expect(buildVideoFilename('My Video', '***', 'mp4')).toBe(
      'My Video - Unknown Channel.mp4',
    );
  });

  it('truncates long stem to 200 chars before adding extension', () => {
    const longTitle = 'A'.repeat(150);
    const longUploader = 'B'.repeat(100);
    const result = buildVideoFilename(longTitle, longUploader, 'mp4');
    const stem = result.replace(/\.mp4$/, '');
    expect(stem.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('.mp4')).toBe(true);
  });

  it('collapses multiple spaces to a single space', () => {
    expect(buildVideoFilename('Title  With   Spaces', 'Ch', 'mp4')).toBe(
      'Title With Spaces - Ch.mp4',
    );
  });
});
