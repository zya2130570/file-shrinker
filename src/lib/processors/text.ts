import { gzip } from 'zlib';
import { promisify } from 'util';
import type { ProcessorResult } from '@/types';

const gzipAsync = promisify(gzip);

export async function processTextBuffer(buffer: Buffer): Promise<ProcessorResult> {
  try {
    const compressed = await gzipAsync(buffer, { level: 9 });

    if (compressed.length >= buffer.length) {
      return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'no_savings' };
    }

    return {
      optimizedBuffer: compressed,
      optimizedExt: '.gz',
      compressionMethod: 'gzip level 9',
      status: 'optimized',
    };
  } catch (err) {
    console.error('Text compression failed:', err);
    return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'failed' };
  }
}
