import { formatBytes, getSavingsPercent, getCategory, mimeToExt } from '@/lib/storage';

describe('formatBytes', () => {
  it('formats 0 bytes', () => expect(formatBytes(0)).toBe('0 B'));
  it('formats bytes', () => expect(formatBytes(512)).toBe('512 B'));
  it('formats kilobytes', () => expect(formatBytes(1024)).toBe('1 KB'));
  it('formats megabytes', () => expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB'));
  it('formats gigabytes', () => expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB'));
});

describe('getSavingsPercent', () => {
  it('computes 50% savings', () => expect(getSavingsPercent(1000, 500)).toBe(50));
  it('computes 0% when equal', () => expect(getSavingsPercent(1000, 1000)).toBe(0));
  it('returns 0 for zero-byte original', () => expect(getSavingsPercent(0, 0)).toBe(0));
  it('rounds to one decimal', () => expect(getSavingsPercent(3, 1)).toBe(66.7));
});

describe('getCategory', () => {
  it('detects images', () => expect(getCategory('image/png')).toBe('images'));
  it('detects pdfs', () => expect(getCategory('application/pdf')).toBe('pdfs'));
  it('detects audio', () => expect(getCategory('audio/mpeg')).toBe('audio'));
  it('detects video', () => expect(getCategory('video/mp4')).toBe('video'));
  it('detects text', () => expect(getCategory('text/plain')).toBe('documents'));
  it('detects json', () => expect(getCategory('application/json')).toBe('documents'));
  it('detects csv', () => expect(getCategory('text/csv')).toBe('documents'));
  it('falls back to other', () => expect(getCategory('application/zip')).toBe('other'));
});

describe('mimeToExt', () => {
  it('maps image/jpeg to .jpg', () => expect(mimeToExt('image/jpeg')).toBe('.jpg'));
  it('maps video/mp4 to .mp4', () => expect(mimeToExt('video/mp4')).toBe('.mp4'));
  it('returns empty string for unknown', () => expect(mimeToExt('application/octet-stream')).toBe(''));
});
