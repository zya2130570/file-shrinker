// All file I/O goes through Supabase Storage — no local filesystem needed.

export const ORIGINALS_BUCKET = 'fsa-originals';
export const OPTIMIZED_BUCKET = 'fsa-optimized';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getSavingsPercent(original: number, optimized: number): number {
  if (original === 0) return 0;
  return Math.round(((original - optimized) / original) * 100 * 10) / 10;
}

export function getCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf') return 'pdfs';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/csv'
  ) return 'documents';
  return 'other';
}

export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/tiff': '.tiff', 'image/bmp': '.bmp',
    'application/pdf': '.pdf',
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav',
    'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/aac': '.aac',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
    'video/quicktime': '.mov', 'video/x-msvideo': '.avi',
    'text/plain': '.txt', 'text/csv': '.csv', 'application/json': '.json',
    'application/csv': '.csv', 'text/html': '.html', 'text/xml': '.xml', 'application/xml': '.xml',
  };
  return map[mimeType] ?? '';
}

export function extToMime(ext: string): string {
  const map: Record<string, string> = {
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac',
    '.pdf': 'application/pdf', '.gz': 'application/gzip',
    '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
    '.html': 'text/html',
  };
  return map[ext] ?? 'application/octet-stream';
}
