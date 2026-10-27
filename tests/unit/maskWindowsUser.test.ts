import { maskWindowsUserText } from '@src/domain/diagnostics/maskWindowsUser.js';
import { describe, expect, it } from 'vitest';

describe('maskWindowsUserText', () => {
  it('masks backslashes, forward slashes, and a different case of the same name', () => {
    const masked = maskWindowsUserText(
      [
        'C:\\Users\\Joao\\Downloads\\video.mp4',
        'C:/Users/Joao/ffmpeg.exe',
        'c:\\users\\JOAO\\Desktop',
        'USERPROFILE=C:\\Users\\Joao',
        'HOMEPATH=\\Users\\Joao',
        'USERNAME=joao',
      ].join('\n'),
    );
    expect(masked).not.toMatch(/joao/i);
    expect(masked).toContain('C:\\Users\\<user>\\Downloads\\video.mp4');
    expect(masked).toContain('C:/Users/<user>/ffmpeg.exe');
    expect(masked).toContain('c:\\users\\<user>\\Desktop');
    expect(masked).toContain('USERPROFILE=C:\\Users\\<user>');
    expect(masked).toContain('HOMEPATH=\\Users\\<user>');
    expect(masked).toContain('USERNAME=<user>');
  });

  it('masks a user name inside an escaped yt-dlp path', () => {
    const masked = maskWindowsUserText(
      'C:\\\\Users\\\\Joao\\\\AppData\\\\yt-dlp.exe',
    );
    expect(masked).toBe('C:\\\\Users\\\\<user>\\\\AppData\\\\yt-dlp.exe');
  });

  it('does not replace the name when it is part of a longer token', () => {
    const masked = maskWindowsUserText(
      'C:\\Users\\Joao\\Downloaded\\JoaoExtra.txt',
    );
    expect(masked).toBe('C:\\Users\\<user>\\Downloaded\\JoaoExtra.txt');
  });

  it('does not mask well-known Windows profile folders', () => {
    expect(maskWindowsUserText('C:\\Users\\Public\\Desktop')).toBe(
      'C:\\Users\\Public\\Desktop',
    );
    expect(maskWindowsUserText('C:\\Users\\PUBLIC\\Documents')).toBe(
      'C:\\Users\\PUBLIC\\Documents',
    );
  });

  it('leaves text with no Windows user folder unchanged', () => {
    expect(maskWindowsUserText('/usr/local/bin/yt-dlp')).toBe(
      '/usr/local/bin/yt-dlp',
    );
  });

  it('masks a capital Users folder on its own', () => {
    expect(maskWindowsUserText('C:\\Users\\Joao')).toBe('C:\\Users\\<user>');
  });

  it('masks a lowercase users folder on its own', () => {
    expect(maskWindowsUserText('c:/users/joao/file')).toBe(
      'c:/users/<user>/file',
    );
  });

  it('masks non-ASCII names, spaces, short names, file URLs, and a cut path', () => {
    expect(maskWindowsUserText('C:\\Users\\João\\Videos')).toBe(
      'C:\\Users\\<user>\\Videos',
    );
    expect(maskWindowsUserText('C:\\Users\\John Doe\\Videos\\clip.mp4')).toBe(
      'C:\\Users\\<user>\\Videos\\clip.mp4',
    );
    expect(
      maskWindowsUserText('C:\\Users\\JOOBIS~1\\AppData\\yt-dlp.exe'),
    ).toBe('C:\\Users\\<user>\\AppData\\yt-dlp.exe');
    expect(
      maskWindowsUserText('file:///C:/Users/Jo%C3%A3o/AppData/Local/Temp/x'),
    ).toBe('file:///C:/Users/<user>/AppData/Local/Temp/x');
    const cut = `\\Users\\Joao\\AppData\\Local\\Temp\\${'x'.repeat(280)}`;
    expect(cut.length).toBeGreaterThan(260);
    expect(maskWindowsUserText(cut)).toBe(
      `\\Users\\<user>\\AppData\\Local\\Temp\\${'x'.repeat(280)}`,
    );
    expect(maskWindowsUserText('C:\\\\Users\\\\Joao\\\\file.txt')).toBe(
      'C:\\\\Users\\\\<user>\\\\file.txt',
    );
  });

  it('masks the name at the start of the text and keeps dot folders', () => {
    expect(maskWindowsUserText('Joao\nC:\\Users\\Joao')).toBe(
      '<user>\nC:\\Users\\<user>',
    );
    expect(maskWindowsUserText('C:\\Users\\.\\file.txt')).toBe(
      'C:\\Users\\.\\file.txt',
    );
    expect(maskWindowsUserText('C:\\Users\\..\\Windows')).toBe(
      'C:\\Users\\..\\Windows',
    );
  });
});
