import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET, mimeToExt } from '@/lib/storage';
import { processBuffer } from '@/lib/processors';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff', 'image/bmp',
  'application/pdf',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript', 'application/javascript', 'text/css',
  'application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-7z-compressed',
]);

function err(message: string, detail: string, status: number) {
  return NextResponse.json({ success: false, error: message, detail }, { status });
}

export async function POST(request: NextRequest) {
  // 1. Parse form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    return err('Failed to parse upload', e instanceof Error ? e.message : String(e), 400);
  }

  const file = formData.get('file') as File | null;
  if (!file) return err('No file provided', 'The "file" field is missing from the form data', 400);

  // 2. Validate
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return err(
      `Unsupported file type: ${file.type || '(unknown)'}`,
      'Supported: images, PDFs, audio, video, text, CSV, JSON, ZIP',
      400
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return err(`File too large (${Math.round(file.size / 1024 / 1024)} MB)`, 'Maximum is 500 MB', 400);
  }

  // 3. Read bytes — keep as ArrayBuffer so we can pass Uint8Array to Supabase Storage.
  // Node.js Buffer passed directly to the fetch-based Supabase client gets coerced
  // to a string via toString(), corrupting every byte > 127.
  let arrayBuffer: ArrayBuffer;
  let buffer: Buffer;
  try {
    arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (e) {
    return err('Failed to read file data', e instanceof Error ? e.message : String(e), 400);
  }

  // 4. Upload original to Supabase Storage (Uint8Array keeps binary intact)
  const uuid = uuidv4();
  const ext = mimeToExt(file.type);
  const originalStoragePath = `${uuid}${ext}`;
  const originalFilename = path.basename(file.name).replace(/[^\w.\- ]/g, '_').slice(0, 255);

  const { error: uploadError } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .upload(originalStoragePath, new Uint8Array(arrayBuffer), { contentType: file.type, upsert: false });

  if (uploadError) {
    return err(
      'Failed to store file',
      `Supabase Storage error: ${uploadError.message}`,
      500
    );
  }

  // 5. Optimize in memory
  let optResult;
  try {
    optResult = await processBuffer(buffer, file.type);
  } catch (e) {
    optResult = { optimizedBuffer: null, optimizedExt: null, compressionMethod: null, status: 'failed' as const };
    console.error('Optimization error:', e);
  }

  // 6. Upload optimized if we have one
  let optimizedStoragePath: string | null = null;
  let optimizedSize: number | null = null;

  if (optResult.optimizedBuffer && optResult.optimizedExt) {
    optimizedStoragePath = `${uuid}${optResult.optimizedExt}`;
    const optMime = optResult.optimizedExt === '.gz' ? 'application/gzip'
      : optResult.optimizedExt === '.webp' ? 'image/webp'
      : file.type;

    const { error: optUploadError } = await supabase.storage
      .from(OPTIMIZED_BUCKET)
      .upload(optimizedStoragePath, new Uint8Array(optResult.optimizedBuffer), { contentType: optMime, upsert: false });

    if (optUploadError) {
      console.error('Optimized upload failed:', optUploadError.message);
      // Non-fatal: keep original, mark as failed
      optimizedStoragePath = null;
      optResult = { ...optResult, status: 'failed' as const, optimizedBuffer: null };
    } else {
      optimizedSize = optResult.optimizedBuffer.length;
    }
  }

  // 7. Insert metadata into Supabase Postgres
  const { data: record, error: dbError } = await supabase
    .from('files')
    .insert({
      id: uuid,
      original_filename: originalFilename,
      mime_type: file.type,
      original_size: file.size,
      optimized_size: optimizedSize,
      compression_method: optResult.compressionMethod,
      upload_date: new Date().toISOString(),
      original_storage_path: originalStoragePath,
      optimized_storage_path: optimizedStoragePath,
      optimization_status: optResult.status,
    })
    .select()
    .single();

  if (dbError) {
    // Clean up storage on DB failure
    await supabase.storage.from(ORIGINALS_BUCKET).remove([originalStoragePath]);
    if (optimizedStoragePath) await supabase.storage.from(OPTIMIZED_BUCKET).remove([optimizedStoragePath]);
    return err('Database insert failed', dbError.message, 500);
  }

  return NextResponse.json({ success: true, file: record }, { status: 201 });
}

export const maxDuration = 60;
