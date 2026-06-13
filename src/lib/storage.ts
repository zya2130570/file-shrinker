import path from 'path';
import fs from 'fs';

// On Vercel the project root is read-only; /tmp is the only writable location.
// VERCEL env var is set to "1" automatically in all Vercel deployments.
const BASE_DIR = process.env.VERCEL === '1'
  ? '/tmp/file-shrinker'
  : path.join(process.cwd(), 'uploads');

export const ORIGINALS_DIR = path.join(BASE_DIR, 'originals');
export const OPTIMIZED_DIR = path.join(BASE_DIR, 'optimized');

export function ensureStorageDirs(): void {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
}

// Sanitize to prevent path traversal — only keep the UUID basename
export function safeFilePath(dir: string, uuid: string, ext: string): string {
  const safeName = path.basename(uuid) + ext;
  return path.join(dir, safeName);
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best-effort deletion
  }
}

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

// Map MIME types to file categories
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
  )
    return 'documents';
  return 'other';
}

// Returns a safe file extension from MIME type
export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/tiff': '.tiff',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac',
    'audio/aac': '.aac',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/csv': '.csv',
    'text/html': '.html',
    'text/xml': '.xml',
    'application/xml': '.xml',
  };
  return map[mimeType] ?? '';
}

// Already-compressed MIME types that are unlikely to benefit from re-compression
export const ALREADY_COMPRESSED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-bzip2',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'video/mp4',
  'video/webm',
]);
