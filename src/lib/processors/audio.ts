import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { OPTIMIZED_DIR } from '../storage';
import type { ProcessorResult } from '@/types';

const execFileAsync = promisify(execFile);

// TODO: Install FFmpeg (`apt install ffmpeg`) to enable audio transcoding
export async function processAudio(
  inputPath: string,
  uuid: string
): Promise<ProcessorResult> {
  const outputPath = path.join(OPTIMIZED_DIR, `${uuid}.mp3`);
  const originalSize = fs.statSync(inputPath).size;

  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      '-y',
      outputPath,
    ]);

    if (!fs.existsSync(outputPath)) {
      return { optimizedPath: null, optimizedSize: null, compressionMethod: null, status: 'failed' };
    }

    const optimizedSize = fs.statSync(outputPath).size;
    if (optimizedSize >= originalSize) {
      fs.unlinkSync(outputPath);
      return { optimizedPath: null, optimizedSize: null, compressionMethod: null, status: 'no_savings' };
    }

    return {
      optimizedPath: outputPath,
      optimizedSize,
      compressionMethod: 'FFmpeg MP3 128kbps',
      status: 'optimized',
    };
  } catch {
    return { optimizedPath: null, optimizedSize: null, compressionMethod: null, status: 'unsupported' };
  }
}
