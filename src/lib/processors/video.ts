import type { ProcessorResult } from '@/types';

// TODO: Install FFmpeg (`apt install ffmpeg`) to enable video transcoding.
// In a serverless environment, FFmpeg must be bundled as a Lambda layer or
// use a service like AWS MediaConvert.
export async function processVideoBuffer(_buffer: Buffer): Promise<ProcessorResult> {
  return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'unsupported' };
}
