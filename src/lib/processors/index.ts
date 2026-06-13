import { processImage, shouldSkipImageOptimization } from './image';
import { processPdf } from './pdf';
import { processAudio } from './audio';
import { processVideo } from './video';
import { processText } from './text';
import type { ProcessorResult } from '@/types';

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'application/csv',
  'text/html',
  'text/xml',
  'application/xml',
  'text/javascript',
  'application/javascript',
  'text/css',
]);

export async function processFile(
  inputPath: string,
  uuid: string,
  mimeType: string,
  originalSize: number
): Promise<ProcessorResult> {
  if (mimeType.startsWith('image/')) {
    if (shouldSkipImageOptimization(mimeType, originalSize)) {
      return { optimizedPath: null, optimizedSize: null, compressionMethod: null, status: 'no_savings' };
    }
    return processImage(inputPath, uuid, mimeType);
  }

  if (mimeType === 'application/pdf') {
    return processPdf(inputPath, uuid);
  }

  if (mimeType.startsWith('audio/')) {
    return processAudio(inputPath, uuid);
  }

  if (mimeType.startsWith('video/')) {
    return processVideo(inputPath, uuid);
  }

  if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
    return processText(inputPath, uuid);
  }

  return {
    optimizedPath: null,
    optimizedSize: null,
    compressionMethod: null,
    status: 'unsupported',
  };
}
