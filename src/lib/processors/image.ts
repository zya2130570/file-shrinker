import type { ProcessorResult } from '@/types';

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

export async function processImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ProcessorResult> {
  if (mimeType === 'image/svg+xml' || buffer.length < 10 * 1024) {
    return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'no_savings' };
  }

  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();

    let pipeline = sharp(buffer);
    if (meta.width && meta.width > MAX_WIDTH) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    const optimizedBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();

    if (optimizedBuffer.length >= buffer.length) {
      return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'no_savings' };
    }

    const resizeNote = meta.width && meta.width > MAX_WIDTH ? `, resized to ${MAX_WIDTH}px` : '';
    return {
      optimizedBuffer,
      optimizedExt: '.webp',
      compressionMethod: `WebP (quality ${WEBP_QUALITY}${resizeNote})`,
      status: 'optimized',
    };
  } catch (err) {
    console.error('Image processing failed:', err);
    return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'failed' };
  }
}
