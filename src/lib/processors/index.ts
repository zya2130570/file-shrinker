import { processImageBuffer } from './image';
import { processPdfBuffer } from './pdf';
import { processAudioBuffer } from './audio';
import { processVideoBuffer } from './video';
import { processTextBuffer } from './text';
import type { ProcessorResult } from '@/types';

const TEXT_MIME_TYPES = new Set([
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript',
  'application/javascript', 'text/css',
]);

export async function processBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ProcessorResult> {
  if (mimeType.startsWith('image/')) return processImageBuffer(buffer, mimeType);
  if (mimeType === 'application/pdf') return processPdfBuffer(buffer);
  if (mimeType.startsWith('audio/')) return processAudioBuffer(buffer);
  if (mimeType.startsWith('video/')) return processVideoBuffer(buffer);
  if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) return processTextBuffer(buffer);

  return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'unsupported' };
}
