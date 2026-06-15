import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET } from '@/lib/storage';
import { processBuffer } from '@/lib/processors';
import {
  compressPdfWithILoveApi,
  isILoveApiConfigured,
  type ILoveApiCreditUpdate,
} from '@/lib/iloveapi';

const OPTIMIZABLE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp', 'image/webp',
  'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript', 'application/javascript', 'text/css',
]);

const OFFICE_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/rtf',
  'text/rtf',
]);

const ARCHIVE_TYPES = new Set([
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
]);

export async function POST(request: NextRequest) {
  let body: {
    uuid?: string; storagePath?: string; originalFilename?: string;
    mimeType?: string; size?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { uuid, storagePath, originalFilename, mimeType, size } = body;
  if (!uuid || !storagePath || !mimeType || !size) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  let optimizedStoragePath: string | null = null;
  let optimizedSize: number | null = null;
  let optStatus: string = 'unsupported';
  let compressionMethod: string | null = null;
  let creditUpdate: ILoveApiCreditUpdate | null = null;

  try {
    const { data: blob, error: dlErr } = await supabase.storage.from(ORIGINALS_BUCKET).download(storagePath);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Download returned empty');

    const buffer = Buffer.from(await blob.arrayBuffer());
    let optimizedBuffer: Buffer | null = null;
    let optimizedExt: string | null = null;
    let optimizedMime: string | null = null;

    if (mimeType === 'application/pdf') {
      if (!isILoveApiConfigured()) {
        optStatus = 'unsupported';
        compressionMethod = 'PDF saved as the original only. Connect iLoveAPI to enable PDF compression.';
      } else {
        const result = await compressPdfWithILoveApi(
          buffer,
          originalFilename ?? 'document.pdf',
          'recommended'
        );
        creditUpdate = result.credits;
        optimizedBuffer = result.buffer;
        optimizedExt = '.pdf';
        optimizedMime = 'application/pdf';
        compressionMethod = 'iLoveAPI PDF compression (recommended)';
        optStatus = result.buffer.length < buffer.length ? 'optimized' : 'no_savings';
      }
    } else if (OPTIMIZABLE_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
      const result = await processBuffer(buffer, mimeType);
      optimizedBuffer = result.optimizedBuffer;
      optimizedExt = result.optimizedExt;
      compressionMethod = result.compressionMethod;
      optStatus = result.status;
      optimizedMime = result.optimizedExt === '.gz' ? 'application/gzip' : 'image/webp';
    } else if (OFFICE_TYPES.has(mimeType)) {
      optStatus = 'unsupported';
      compressionMethod = 'Saved as the original only. Office files are already compressed internally, so recompressing them usually provides little or no benefit.';
    } else if (ARCHIVE_TYPES.has(mimeType)) {
      optStatus = 'unsupported';
      compressionMethod = 'Saved as the original only. This is already a compressed archive, so another compression pass would usually not make it meaningfully smaller.';
    } else if (mimeType.startsWith('audio/')) {
      optStatus = 'unsupported';
      compressionMethod = 'Saved as the original only. Audio compression is not enabled in this version.';
    } else if (mimeType.startsWith('video/')) {
      optStatus = 'unsupported';
      compressionMethod = 'Saved as the original only. Video compression is not enabled in this version.';
    } else {
      optStatus = 'unsupported';
      compressionMethod = 'Saved as the original only. FileShrinker does not currently have a safe, useful compressor for this format.';
    }

    if (optimizedBuffer && optimizedExt && optimizedMime && optimizedBuffer.length < buffer.length) {
      const optPath = `${uuid}${optimizedExt}`;
      const optBlob = new Blob([new Uint8Array(optimizedBuffer)], { type: optimizedMime });
      const { error: upErr } = await supabase.storage.from(OPTIMIZED_BUCKET).upload(optPath, optBlob, {
        contentType: optimizedMime,
        upsert: false,
      });

      if (upErr) {
        console.error('Optimized upload failed:', upErr.message);
        optStatus = 'failed';
        compressionMethod = 'Compression succeeded, but saving the optimized copy failed';
      } else {
        optimizedStoragePath = optPath;
        optimizedSize = optimizedBuffer.length;
        optStatus = 'optimized';
      }
    }
  } catch (err) {
    console.error('Optimization pipeline error:', err);
    optStatus = 'failed';
    compressionMethod = mimeType === 'application/pdf'
      ? 'iLoveAPI PDF compression failed. The original file was kept.'
      : 'Optimization failed. The original file was kept.';
  }

  const { data: record, error: dbError } = await supabase
    .from('files')
    .insert({
      id: uuid,
      original_filename: originalFilename ?? storagePath,
      mime_type: mimeType,
      original_size: size,
      optimized_size: optimizedSize,
      compression_method: compressionMethod,
      upload_date: new Date().toISOString(),
      original_storage_path: storagePath,
      optimized_storage_path: optimizedStoragePath,
      optimization_status: optStatus,
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(ORIGINALS_BUCKET).remove([storagePath]);
    if (optimizedStoragePath) await supabase.storage.from(OPTIMIZED_BUCKET).remove([optimizedStoragePath]);
    return NextResponse.json({ success: false, error: 'Database insert failed', detail: dbError.message }, { status: 500 });
  }

  const savings_percent =
    record.optimized_size != null && record.original_size > 0
      ? Math.round(((record.original_size - record.optimized_size) / record.original_size) * 1000) / 10
      : null;

  return NextResponse.json({
    success: true,
    file: { ...record, savings_percent },
    credit_update: creditUpdate,
  }, { status: 201 });
}

export const maxDuration = 60;
