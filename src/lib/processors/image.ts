import fs from 'fs';
import path from 'path';
import { OPTIMIZED_DIR } from '../storage';
import type { ProcessorResult } from '@/types';

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

export async function processImage(
  inputPath: string,
  uuid: string,
  mimeType: string
): Promise<ProcessorResult> {
  try {
    // Dynamic import so server startup isn't blocked if sharp fails to load
    const sharp = (await import('sharp')).default;

    const outputPath = path.join(OPTIMIZED_DIR, `${uuid}.webp`);
    const metadata = await sharp(inputPath).metadata();

    let pipeline = sharp(inputPath);

    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    await pipeline.webp({ quality: WEBP_QUALITY }).toFile(outputPath);

    const optimizedSize = fs.statSync(outputPath).size;
    const originalSize = fs.statSync(inputPath).size;

    // If webp is larger than original, discard it
    if (optimizedSize >= originalSize) {
      fs.unlinkSync(outputPath);
      return {
        optimizedPath: null,
        optimizedSize: null,
        compressionMethod: null,
        status: 'no_savings',
      };
    }

    return {
      optimizedPath: outputPath,
      optimizedSize,
      compressionMethod: `WebP (quality ${WEBP_QUALITY})${metadata.width && metadata.width > MAX_WIDTH ? `, resized to ${MAX_WIDTH}px` : ''}`,
      status: 'optimized',
    };
  } catch (err) {
    console.error('Image processing failed:', err);
    return {
      optimizedPath: null,
      optimizedSize: null,
      compressionMethod: null,
      status: 'failed',
    };
  }
}

// SVGs and already-tiny images skip conversion
export function shouldSkipImageOptimization(mimeType: string, sizeBytes: number): boolean {
  return mimeType === 'image/svg+xml' || sizeBytes < 10 * 1024; // < 10 KB
}
