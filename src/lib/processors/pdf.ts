import type { ProcessorResult } from '@/types';

// TODO: Ghostscript/qpdf are not available in standard serverless environments.
// Options: use a PDF processing API (e.g. ilovepdf, pdfco) or a Lambda layer.
export async function processPdfBuffer(_buffer: Buffer): Promise<ProcessorResult> {
  return { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'unsupported' };
}
