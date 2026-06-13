import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { OPTIMIZED_DIR } from '../storage';
import type { ProcessorResult } from '@/types';

export async function processText(
  inputPath: string,
  uuid: string
): Promise<ProcessorResult> {
  const outputPath = path.join(OPTIMIZED_DIR, `${uuid}.gz`);
  const originalSize = fs.statSync(inputPath).size;

  try {
    const source = fs.createReadStream(inputPath);
    const destination = fs.createWriteStream(outputPath);
    const gzip = createGzip({ level: 9 });

    await pipeline(source, gzip, destination);

    const optimizedSize = fs.statSync(outputPath).size;

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
      compressionMethod: 'gzip level 9',
      status: 'optimized',
    };
  } catch (err) {
    console.error('Text compression failed:', err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return {
      optimizedPath: null,
      optimizedSize: null,
      compressionMethod: null,
      status: 'failed',
    };
  }
}
