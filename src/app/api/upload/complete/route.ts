import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET } from '@/lib/storage';
import { processBuffer } from '@/lib/processors';

const OPTIMIZABLE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp', 'image/webp',
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript', 'application/javascript', 'text/css',
]);

// Step 3 of 3: called after the browser finishes the direct Supabase Storage upload.
// Receives JSON metadata only — no file bytes come through Vercel.
// Downloads the stored file (for optimizable types), runs optimization, and inserts the DB record.
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

  // Optimization: download from storage, process in memory, re-upload
  let optimizedStoragePath: string | null = null;
  let optimizedSize: number | null = null;
  let optStatus: string = 'unsupported';
  let compressionMethod: string | null = null;

  if (OPTIMIZABLE_TYPES.has(mimeType)) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(ORIGINALS_BUCKET).download(storagePath);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Download returned empty');

      const buffer = Buffer.from(await blob.arrayBuffer());
      const result = await processBuffer(buffer, mimeType);

      optStatus = result.status;
      compressionMethod = result.compressionMethod;

      if (result.optimizedBuffer && result.optimizedExt) {
        const optPath = `${uuid}${result.optimizedExt}`;
        const optMime = result.optimizedExt === '.gz' ? 'application/gzip' : 'image/webp';

        // Wrap in Uint8Array to satisfy BlobPart typing (Buffer's ArrayBufferLike
        // doesn't narrow to ArrayBuffer in strict mode)
        const optBlob = new Blob([new Uint8Array(result.optimizedBuffer)], { type: optMime });
        const { error: upErr } = await supabase.storage.from(OPTIMIZED_BUCKET).upload(optPath, optBlob, {
          contentType: optMime,
          upsert: false,
        });

        if (upErr) {
          console.error('Optimized upload failed:', upErr.message);
          optStatus = 'failed';
        } else {
          optimizedStoragePath = optPath;
          optimizedSize = result.optimizedBuffer.length;
        }
      }
    } catch (err) {
      console.error('Optimization pipeline error:', err);
      optStatus = 'failed';
    }
  }

  // Insert metadata record
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
    // Clean up storage on DB failure (best-effort)
    await supabase.storage.from(ORIGINALS_BUCKET).remove([storagePath]);
    if (optimizedStoragePath) await supabase.storage.from(OPTIMIZED_BUCKET).remove([optimizedStoragePath]);
    return NextResponse.json({ success: false, error: 'Database insert failed', detail: dbError.message }, { status: 500 });
  }

  const savings_percent =
    record.optimized_size != null && record.original_size > 0
      ? Math.round(((record.original_size - record.optimized_size) / record.original_size) * 1000) / 10
      : null;

  return NextResponse.json({ success: true, file: { ...record, savings_percent } }, { status: 201 });
}

export const maxDuration = 60;
